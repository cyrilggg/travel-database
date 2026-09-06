#!/usr/bin/env python3
"""从固定 GeoNames 快照生成北马其顿全部 34 个城市中心点。"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


SOURCE_SHA256 = "063C22470EE3690820943B5962B0F53F5B5C3978B3B789B324A574C24337714F"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "mk-official-cities-2026-09-06.csv"
)

OFFICIAL_CITY_IDS = {
    "792656": "Berovo",
    "792578": "Bitola",
    "792523": "Bogdanci",
    "784733": "Valandovo",
    "785058": "Veles",
    "784424": "Vinica",
    "790744": "Gevgelija",
    "790295": "Gostivar",
    "791606": "Debar",
    "791559": "Delčevo",
    "791542": "Demir Kapija",
    "787778": "Demir Hisar",
    "789541": "Kavadarci",
    "789527": "Kičevo",
    "789403": "Kočani",
    "789091": "Kratovo",
    "789045": "Kriva Palanka",
    "788961": "Kruševo",
    "788886": "Kumanovo",
    "789629": "Makedonska Kamenica",
    "792257": "Makedonski Brod",
    "787716": "Negotino",
    "787487": "Ohrid",
    "787147": "Pehčevo",
    "786735": "Prilep",
    "786700": "Probištip",
    "786565": "Radoviš",
    "786341": "Resen",
    "785842": "Skopje",
    "785387": "Struga",
    "785380": "Strumica",
    "785201": "Sveti Nikole",
    "785082": "Tetovo",
    "785482": "Štip",
}

REGIONS = {
    "斯科普里统计区": {"Skopje"},
    "佩拉戈尼亚统计区": {"Bitola", "Demir Hisar", "Kruševo", "Prilep", "Resen"},
    "波洛格统计区": {"Gostivar", "Tetovo"},
    "西南统计区": {"Debar", "Kičevo", "Makedonski Brod", "Ohrid", "Struga"},
    "瓦尔达尔统计区": {"Veles", "Demir Kapija", "Kavadarci", "Negotino", "Sveti Nikole"},
    "东南统计区": {"Bogdanci", "Valandovo", "Gevgelija", "Radoviš", "Strumica"},
    "东部统计区": {
        "Berovo", "Delčevo", "Kočani", "Makedonska Kamenica", "Pehčevo", "Probištip",
        "Štip", "Vinica"
    },
    "东北统计区": {"Kratovo", "Kriva Palanka", "Kumanovo"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_places(path: Path) -> dict[str, dict[str, str]]:
    if sha256(path) != SOURCE_SHA256:
        raise SystemExit(f"GeoNames 北马其顿来源哈希不匹配：{path}")
    places: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[0] not in OFFICIAL_CITY_IDS:
            continue
        places[fields[0]] = {
            "name": fields[1],
            "feature_code": fields[7],
            "population": fields[14] or "0",
            "longitude": fields[5],
            "latitude": fields[4],
        }
    if set(places) != set(OFFICIAL_CITY_IDS):
        missing = sorted(set(OFFICIAL_CITY_IDS) - set(places))
        raise SystemExit(f"GeoNames 缺少北马其顿城市：{missing}")
    return places


def region_for(official_name: str) -> str:
    matches = [region for region, cities in REGIONS.items() if official_name in cities]
    if len(matches) != 1:
        raise SystemExit(f"{official_name} 的统计区映射数量异常：{matches}")
    return matches[0]


def build_rows(places: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    if len(OFFICIAL_CITY_IDS) != 34:
        raise SystemExit(f"北马其顿城市数量应为 34，实际为 {len(OFFICIAL_CITY_IDS)}")
    if set().union(*REGIONS.values()) != set(OFFICIAL_CITY_IDS.values()):
        raise SystemExit("北马其顿城市与统计区映射不一致")

    rows = []
    for geonames_id, official_name in OFFICIAL_CITY_IDS.items():
        place = places[geonames_id]
        rows.append(
            {
                "administrative_code": geonames_id,
                "name": place["name"],
                "official_name": official_name,
                "admin_area": region_for(official_name),
                "city_level": "capital" if place["feature_code"] == "PPLC" else "official_city",
                "geonames_id": geonames_id,
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if feature_counts != Counter({"PPLA": 33, "PPLC": 1}):
        raise SystemExit(f"城市来源层级数量已变化：{dict(feature_counts)}")
    for field in ("administrative_code", "geonames_id", "official_name"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (20.4 <= longitude <= 23.1 and 40.8 <= latitude <= 42.4):
            raise SystemExit(f"{row['official_name']} 坐标超出北马其顿范围")

    return sorted(rows, key=lambda row: (row["admin_area"], row["official_name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-north-macedonia-official-cities.py <MK.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 34 个北马其顿城市中心点")


if __name__ == "__main__":
    main()
