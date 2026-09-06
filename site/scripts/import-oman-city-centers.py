#!/usr/bin/env python3
"""Build Oman's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-oman-city-centers.py <OM.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "E07528CBC14A205BD3C6083DCA15BB0C51767E72D540CB857041589D3F1D597B"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 20,
    "PPLA": 8,
    "PPLA2": 1,
    "PPLC": 1,
    "PPLX": 2,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "om-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "达希利耶省",
    "02": "南巴提奈省",
    "03": "中部省",
    "04": "南东部省",
    "06": "马斯喀特省",
    "07": "穆桑达姆省",
    "08": "佐法尔省",
    "09": "扎希拉省",
    "10": "布赖米省",
    "11": "北巴提奈省",
    "12": "北东部省",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL", "PPLX"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "governorate_capital",
    "PPLA2": "second_order_administrative_seat",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
    "PPLX": "official_city_or_populated_place_5000_plus",
}

FORCE_INCLUDED_GEONAMES_IDS = {
    "287275",  # Muttrah: identified by Oman's Foreign Ministry as a historic city.
    "288789",  # Barka: a separate wilayat town with population above 5,000.
}
EXCLUDED_GEONAMES_IDS = {
    "286293",  # Sufalat Samail duplicates the retained Samail city center.
    "412084",  # Bayt al Awabi is an internal section of Al Awabi, not a separate city.
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
        raise SystemExit(f"GeoNames 阿曼快照哈希变化：{actual_hash}")

    places = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P" or values[7] not in ALLOWED_FEATURES:
                continue
            if values[0] in EXCLUDED_GEONAMES_IDS:
                continue
            population = int(values[14] or 0)
            if (
                population > 5000
                or values[7] in ADMINISTRATIVE_FEATURES
                or values[0] in FORCE_INCLUDED_GEONAMES_IDS
            ):
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
        if not (51.8 <= longitude <= 59.9 and 16.5 <= latitude <= 26.5):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出阿曼范围")

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
        raise SystemExit(f"阿曼城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 32:
        raise SystemExit(f"阿曼城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("阿曼 11 个省覆盖发生变化")

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
            "用法：py -3.12 scripts/import-oman-city-centers.py <OM.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 32 个阿曼城市级中心点")


if __name__ == "__main__":
    main()
