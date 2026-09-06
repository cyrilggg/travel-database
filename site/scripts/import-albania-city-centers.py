#!/usr/bin/env python3
"""Build Albania's official urban-city catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-albania-city-centers.py <AL.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "35E214657A911E009FB5B019308B1360276AEC89F0B2168BD71F7E7DB26B3A55"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 6,
    "PPLA": 11,
    "PPLA2": 23,
    "PPLA3": 33,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "al-official-cities-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "40": "培拉特州",
    "41": "迪勃拉州",
    "42": "都拉斯州",
    "43": "爱尔巴桑州",
    "44": "费里州",
    "45": "吉诺卡斯特州",
    "46": "科尔察州",
    "47": "库克斯州",
    "48": "莱什州",
    "49": "斯库台州",
    "50": "地拉那州",
    "51": "发罗拉州",
}

# INSTAT's 2014 urban classification lists 74 physical cities separately from
# villages. IDs bind each named city to the fixed GeoNames country snapshot.
OFFICIAL_CITY_NAMES = {
    "7932375": "Bajram Curri",
    "3343181": "Bajzë",
    "3186084": "Berat",
    "3186145": "Ballsh",
    "783606": "Bilisht",
    "783508": "Bulqizë",
    "783493": "Burrel",
    "3185897": "Cërrik",
    "783408": "Çorovodë",
    "363383": "Delvinë",
    "3185797": "Divjakë",
    "3185728": "Durrës",
    "783263": "Elbasan",
    "783259": "Ersekë",
    "3185672": "Fier",
    "783247": "Fierzë",
    "783214": "Fushë-Arrëz",
    "3185638": "Fushë-Krujë",
    "783148": "Gjirokastër",
    "783059": "Gramsh",
    "3185377": "Himarë",
    "782892": "Kam",
    "3185270": "Kamëz",
    "3185211": "Kavajë",
    "782843": "Këlcyrë",
    "3185087": "Krrabë",
    "782806": "Klos",
    "363320": "Konispol",
    "3185133": "Koplik",
    "782756": "Korçë",
    "782707": "Krastë",
    "3185082": "Krujë",
    "782685": "Krumë",
    "3185060": "Kuçovë",
    "782661": "Kukës",
    "782632": "Kurbnesh",
    "3185012": "Laç",
    "782535": "Leskovik",
    "3184935": "Lezhë",
    "782523": "Libohovë",
    "782519": "Librazhd",
    "3184862": "Lushnjë",
    "782393": "Maliq",
    "3184806": "Mamurras",
    "3184801": "Manzë",
    "3184743": "Memaliaj",
    "3184702": "Milot",
    "3184575": "Orikum",
    "3184518": "Patos",
    "3184497": "Peqin",
    "782070": "Përmet",
    "781920": "Përrenjas",
    "782061": "Peshkopi",
    "781988": "Pogradec",
    "781979": "Poliçan",
    "3184388": "Pukë",
    "781809": "Reps",
    "3184290": "Roskovec",
    "3184264": "Rrëshen",
    "3184252": "Rrogozhinë",
    "3184238": "Rubik",
    "363243": "Sarandë",
    "3184197": "Selenicë",
    "3184136": "Shëngjin",
    "3184099": "Shijak",
    "3184081": "Shkodër",
    "3183945": "Sukth",
    "781443": "Tepelenë",
    "3183875": "Tirana",
    "3183824": "Ulëz",
    "3183814": "Ura Vajgurore",
    "3185823": "Vau i Dejës",
    "3183719": "Vlorë",
    "3183708": "Vorë",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_places(path: Path) -> list[list[str]]:
    actual_hash = sha256(path)
    if actual_hash != EXPECTED_GEONAMES_HASH:
        raise SystemExit(f"GeoNames 阿尔巴尼亚快照哈希变化：{actual_hash}")

    places = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) >= 19 and values[0] in OFFICIAL_CITY_NAMES:
                places[values[0]] = values

    missing = sorted(set(OFFICIAL_CITY_NAMES) - set(places))
    if missing:
        raise SystemExit(f"GeoNames 快照缺少官方城市：{missing}")
    for geonames_id, expected_name in OFFICIAL_CITY_NAMES.items():
        actual_name = places[geonames_id][1]
        if actual_name != expected_name:
            raise SystemExit(
                f"GeoNames 城市名称变化：{geonames_id} {actual_name} != {expected_name}"
            )
    return list(places.values())


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin_area = ADMIN_AREA_NAMES.get(place[10])
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的州代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (19.2 <= longitude <= 21.1 and 39.5 <= latitude <= 42.5):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出阿尔巴尼亚范围")

        if feature_code == "PPLC":
            city_level = "country_capital"
        elif feature_code == "PPLA":
            city_level = "county_capital"
        else:
            city_level = "official_urban_city"

        rows.append(
            {
                "administrative_code": geonames_id,
                "name": source_name,
                "admin_area": admin_area,
                "city_level": city_level,
                "geonames_id": geonames_id,
                "feature_code": feature_code,
                "population": place[14] or "0",
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if dict(sorted(feature_counts.items())) != EXPECTED_FEATURE_COUNTS:
        raise SystemExit(f"阿尔巴尼亚来源层级数量变化：{dict(feature_counts)}")
    if len(rows) != 74:
        raise SystemExit(f"阿尔巴尼亚官方城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("阿尔巴尼亚 12 个州覆盖发生变化")

    for field, values in (
        ("稳定 ID", [row["administrative_code"] for row in rows]),
        ("GeoNames ID", [row["geonames_id"] for row in rows]),
        ("中心坐标", [(row["longitude"], row["latitude"]) for row in rows]),
    ):
        duplicates = [value for value, count in Counter(values).items() if count > 1]
        if duplicates:
            raise SystemExit(f"生成结果存在重复{field}：{duplicates}")

    return sorted(
        rows,
        key=lambda row: (
            row["admin_area"],
            row["city_level"],
            row["name"],
            row["administrative_code"],
        ),
    )


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-albania-city-centers.py <AL.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 74 个阿尔巴尼亚官方城市中心点")


if __name__ == "__main__":
    main()
