#!/usr/bin/env python3
"""Build Iraq's city-level catalog from a fixed GeoNames country snapshot.

Usage:
  py -3.12 scripts/import-iraq-city-centers.py <IQ.txt> [output.csv]

The catalog contains administrative seats down to PPLA4 plus ordinary populated
places with more than 5,000 residents. Only PPL and PPLA* city-like features
are accepted. Fixed exclusions remove duplicated city records and Sadr City,
which is an internal district of Baghdad rather than a separate city.
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "F699E53135801F5594C7BD8AA2238B41132DCE82B8967A81547E1B3F852D0164"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 32,
    "PPLA": 17,
    "PPLA2": 82,
    "PPLA3": 21,
    "PPLA4": 1,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "iq-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "安巴尔省",
    "02": "巴士拉省",
    "03": "穆萨纳省",
    "04": "卡迪西亚省",
    "05": "苏莱曼尼亚省",
    "06": "巴比伦省",
    "07": "巴格达省",
    "08": "杜胡克省",
    "09": "济加尔省",
    "10": "迪亚拉省",
    "11": "埃尔比勒省",
    "12": "卡尔巴拉省",
    "13": "基尔库克省",
    "14": "米桑省",
    "15": "尼尼微省",
    "16": "瓦西特省",
    "17": "纳杰夫省",
    "18": "萨拉赫丁省",
    "19": "哈拉卜贾省",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "governorate_capital",
    "PPLA2": "district_seat",
    "PPLA3": "subdistrict_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

# Iraq Law No. 7 of 2025 made Halabja the nineteenth governorate and Halabja
# city its capital. GeoNames still classifies the city as a regular PPL.
HALABJA_GEONAMES_ID = "96205"

# The country extract contains a few pairs for the same city: one ordinary PPL
# record and one administrative-seat record. Prefer the administrative record.
# Hiran is duplicated as two PPLA3 points; the older, plainly named record is
# retained. Sadr City is an internal Baghdad district.
EXCLUDED_GEONAMES_IDS = {
    "445694",  # 'Akra -> Aqrah (98822)
    "13631407",  # Abu al-Kahsib -> Abi al Khasib (100050)
    "10303650",  # Simele -> Sumayl (90532)
    "99169",  # Khalis -> Al Khalis (99168)
    "7097617",  # Nahiyat Hiran -> Hiran (95804)
    "7802746",  # Sadr City, an internal district of Baghdad
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
        raise SystemExit(f"GeoNames 伊拉克快照哈希变化：{actual_hash}")

    places = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P" or values[7] not in ALLOWED_FEATURES:
                continue
            if values[0] in EXCLUDED_GEONAMES_IDS:
                continue
            population = int(values[14] or 0)
            is_administrative_seat = values[7] in ADMINISTRATIVE_FEATURES
            if population > 5000 or is_administrative_seat or values[0] == HALABJA_GEONAMES_ID:
                places.append(values)
    return places


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin1_code = place[10]
        admin_area = ADMIN_AREA_NAMES.get(admin1_code)
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的省代码未收录：{admin1_code}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (38.5 <= longitude <= 49.0 and 29.0 <= latitude <= 37.5):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出伊拉克范围")

        city_level = CITY_LEVELS[feature_code]
        if geonames_id == HALABJA_GEONAMES_ID:
            if admin1_code != "19" or source_name != "Halabja":
                raise SystemExit("哈拉卜贾固定记录发生变化")
            city_level = "governorate_capital"

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
        raise SystemExit(f"伊拉克城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 154:
        raise SystemExit(f"伊拉克城市数量变化：{len(rows)}")
    if Counter(row["admin_area"] for row in rows)["哈拉卜贾省"] != 1:
        raise SystemExit("哈拉卜贾省城市入口数量变化")

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
            "用法：py -3.12 scripts/import-iraq-city-centers.py <IQ.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 154 个伊拉克城市级中心点")


if __name__ == "__main__":
    main()
