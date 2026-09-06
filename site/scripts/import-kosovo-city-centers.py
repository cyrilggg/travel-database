#!/usr/bin/env python3
"""生成科索沃现行市镇中心与补充普通城镇的地图中心点。"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


SOURCE_SHA256 = "AFC2F76FED2AB89B8D62988D546C24C036EEDD6C567C78501344F378BEE05A41"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "xk-city-centers-2026-09-06.csv"
)

# 38 个现行市镇的实体中心；南、北米特罗维察合并为一个城市点，另补入 Banja 与 Leshak。
CITY_IDS = {
    "791580": "Deçan",
    "791646": "Gjakovë",
    "790701": "Drenas",
    "790674": "Gjilan",
    "791122": "Dragash",
    "789996": "Istog",
    "789721": "Kaçanik",
    "789455": "Klinë",
    "789228": "Fushë Kosovë",
    "789227": "Kamenicë",
    "789225": "Mitrovicë",
    "788731": "Leposaviq",
    "788652": "Lipjan",
    "787589": "Novobërdë",
    "787534": "Obiliq",
    "787456": "Rahovec",
    "787157": "Pejë",
    "786950": "Podujevë",
    "786714": "Prishtinë",
    "786712": "Prizren",
    "785642": "Skënderaj",
    "785485": "Shtime",
    "785388": "Shtërpcë",
    "785238": "Suharekë",
    "784759": "Ferizaj",
    "784372": "Viti",
    "784097": "Vushtrri",
    "783802": "Zubin Potok",
    "783770": "Zveçan",
    "788239": "Malishevë",
    "789739": "Junik",
    "788187": "Mamushë",
    "791539": "Hani i Elezit",
    "790265": "Graçanicë",
    "786478": "Ranillug",
    "787197": "Partesh",
    "789427": "Kllokot",
    "830390": "Banja",
    "788727": "Leshak",
}

REGION_NAMES_ZH = {
    "10097360": "普里什蒂纳地区",
    "10097358": "米特罗维察地区",
    "10097359": "佩奇地区",
    "10097361": "普里兹伦地区",
    "10096138": "费里扎伊地区",
    "10097357": "吉兰地区",
    "10096859": "贾科维察地区",
}

SUPPLEMENTAL_TOWN_IDS = {"830390", "788727"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_places(path: Path) -> dict[str, dict[str, str]]:
    if sha256(path) != SOURCE_SHA256:
        raise SystemExit(f"GeoNames 科索沃来源哈希不匹配：{path}")
    places: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[0] not in CITY_IDS:
            continue
        places[fields[0]] = {
            "name": fields[1],
            "feature_code": fields[7],
            "admin1": fields[10],
            "population": fields[14] or "0",
            "longitude": fields[5],
            "latitude": fields[4],
        }
    if set(places) != set(CITY_IDS):
        missing = sorted(set(CITY_IDS) - set(places))
        raise SystemExit(f"GeoNames 缺少科索沃城市中心：{missing}")
    return places


def build_rows(places: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    if len(CITY_IDS) != 39:
        raise SystemExit(f"科索沃城市点数量应为 39，实际为 {len(CITY_IDS)}")
    rows = []
    for geonames_id, official_name in CITY_IDS.items():
        place = places[geonames_id]
        if place["admin1"] not in REGION_NAMES_ZH:
            raise SystemExit(f"{official_name} 缺少七地区映射：{place['admin1']}")
        if geonames_id in SUPPLEMENTAL_TOWN_IDS:
            level = "urban_town"
        elif place["feature_code"] == "PPLC":
            level = "capital"
        else:
            level = "municipal_center"
        rows.append(
            {
                "administrative_code": geonames_id,
                "name": place["name"],
                "official_name": official_name,
                "admin_area": REGION_NAMES_ZH[place["admin1"]],
                "city_level": level,
                "geonames_id": geonames_id,
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if feature_counts != Counter({"PPLC": 1, "PPLA": 6, "PPLA2": 29, "PPL": 3}):
        raise SystemExit(f"城市来源层级数量已变化：{dict(feature_counts)}")
    if set(row["admin_area"] for row in rows) != set(REGION_NAMES_ZH.values()):
        raise SystemExit("生成结果未覆盖科索沃全部七个统计地区")
    for field in ("administrative_code", "geonames_id", "official_name"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (19.9 <= longitude <= 21.8 and 41.8 <= latitude <= 43.3):
            raise SystemExit(f"{row['official_name']} 坐标超出科索沃范围")

    return sorted(rows, key=lambda row: (row["admin_area"], row["city_level"], row["official_name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-kosovo-city-centers.py <XK.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 39 个科索沃城市中心点")


if __name__ == "__main__":
    main()
