#!/usr/bin/env python3
"""Build Palestine's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-palestine-city-centers.py <PS.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "2B85B6C5942A8F6F6B07AE889B7F84D66A8F21CB61E35AE4D48AB5197AC2EF4A"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 95,
    "PPLA": 2,
    "PPLA2": 7,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "ps-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "GZ": "加沙地带",
    "WE": "约旦河西岸",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "administrative_center",
    "PPLA2": "governorate_center",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

EXCLUDED_GEONAMES_IDS = {
    # Duplicate records; retain the older stable locality center.
    "7870523",  # Shokat as-Sufi -> 281093
    "7870319",  # Huwara -> 283636
    # Internal Jerusalem neighborhoods rather than separate cities.
    "284572",  # Atarot
    "284335",  # Beit Hanina
    "281818",  # Shuafat
    "281717",  # Sur Bahir
    "7890300",  # Wadi al-Joz
    # Refugee camps rather than city-level localities.
    "281161",  # Al Bureij
    "281109",  # An Nusayrat
    "284446",  # Balata
    # Israeli settlements/local councils are not classified as Palestinian cities here.
    "12156437",  # Beit El
    "8199386",  # Givat Zeev
    "8199420",  # Oranit
    "7535657",  # Karney Shomron
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
        raise SystemExit(f"GeoNames 巴勒斯坦快照哈希变化：{actual_hash}")

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
                f"{source_name}（{geonames_id}）的地区代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (34.1 <= longitude <= 35.7 and 31.1 <= latitude <= 32.7):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出本批范围")

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
        raise SystemExit(f"巴勒斯坦城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 104:
        raise SystemExit(f"巴勒斯坦城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("巴勒斯坦地区覆盖发生变化")

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
            "用法：py -3.12 scripts/import-palestine-city-centers.py <PS.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 104 个巴勒斯坦城市级中心点")


if __name__ == "__main__":
    main()
