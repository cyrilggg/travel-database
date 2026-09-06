#!/usr/bin/env python3
"""Build Syria's city-level catalog from a fixed GeoNames country snapshot.

Usage:
  py -3.12 scripts/import-syria-city-centers.py <SY.txt> [output.csv]

The catalog contains administrative seats down to PPLA4 plus ordinary populated
places with more than 5,000 residents. Only PPL and PPLA* city-like features
are accepted. Yarmouk is excluded because it is an internal Damascus district
and refugee camp rather than a separate city.
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "B02C93103FBCF70A3AC02048DB3A6F2EE2B814A5BDD3E84A9F56FBCFE78FAD2A"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 26,
    "PPLA": 12,
    "PPLA2": 46,
    "PPLA3": 211,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "sy-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "哈塞克省",
    "02": "拉塔基亚省",
    "03": "库奈特拉省",
    "04": "拉卡省",
    "05": "苏韦达省",
    "06": "德拉省",
    "07": "代尔祖尔省",
    "08": "大马士革农村省",
    "09": "阿勒颇省",
    "10": "哈马省",
    "11": "霍姆斯省",
    "12": "伊德利卜省",
    "13": "大马士革省",
    "14": "塔尔图斯省",
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

EXCLUDED_GEONAMES_IDS = {
    "166716",  # Yarmouk, an internal Damascus district/refugee camp
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
        raise SystemExit(f"GeoNames 叙利亚快照哈希变化：{actual_hash}")

    places = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P" or values[7] not in ALLOWED_FEATURES:
                continue
            if values[0] in EXCLUDED_GEONAMES_IDS:
                continue
            population = int(values[14] or 0)
            if population > 5000 or values[7] in ADMINISTRATIVE_FEATURES:
                places.append(values)
    return places


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin_area = ADMIN_AREA_NAMES.get(place[10])
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的省代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (35.5 <= longitude <= 42.5 and 32.0 <= latitude <= 37.5):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出叙利亚范围")

        rows.append(
            {
                "administrative_code": geonames_id,
                "name": source_name,
                "admin_area": admin_area,
                "city_level": CITY_LEVELS[feature_code],
                "geonames_id": geonames_id,
                "feature_code": feature_code,
                "population": place[14] or "0",
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if dict(sorted(feature_counts.items())) != EXPECTED_FEATURE_COUNTS:
        raise SystemExit(f"叙利亚城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 296:
        raise SystemExit(f"叙利亚城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("叙利亚省级覆盖发生变化")

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
            "用法：py -3.12 scripts/import-syria-city-centers.py <SY.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 296 个叙利亚城市级中心点")


if __name__ == "__main__":
    main()
