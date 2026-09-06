#!/usr/bin/env python3
"""Build Israel's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-israel-city-centers.py <IL.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "FFDADAA0E6159DEE5DB4B390803B30EC5DE99953E3F97C93C81B2E0BF592D5F8"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 153,
    "PPLA": 7,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "il-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "南部区",
    "02": "中央区",
    "03": "北部区",
    "04": "海法区",
    "05": "特拉维夫区",
    "06": "耶路撒冷区",
    "WE": "约旦河西岸",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "administrative_center",
    "PPLA2": "second_order_administrative_seat",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

EXCLUDED_GEONAMES_IDS = {
    # Syrian administrative records in the occupied Golan Heights, not Israeli cities.
    "170378",  # Fiq
    "173550",  # Al Butayhah
    "173601",  # Al Khushniyah
    # Internal Jerusalem neighborhood.
    "293837",  # Qiryat HaYovel
    # Duplicate records; retain one stable city/local-authority center.
    "12156557",  # Binyamina-Giv'at Ada -> 295410
    "12156671",  # Yanuh-Jat -> 11979655
    "293207",  # Yehud -> Yehud-Monosson (10227184)
    # Non-city tribal, village, moshav, and community-settlement records.
    "12156432",  # AlSayid Tribe
    "12156436",  # Bir Hadaj
    "8141252",  # Bat Hefer
    "295473",  # Bet El'azari
    "294545",  # Kfar Habad
    "7117228",  # Caesarea
    "11979772",  # Tsur Itshak
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
        raise SystemExit(f"GeoNames 以色列快照哈希变化：{actual_hash}")

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
        if not (34.2 <= longitude <= 35.9 and 29.0 <= latitude <= 33.4):
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
        raise SystemExit(f"以色列城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 160:
        raise SystemExit(f"以色列城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("以色列地区覆盖发生变化")

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
            "用法：py -3.12 scripts/import-israel-city-centers.py <IL.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 160 个以色列城市级中心点")


if __name__ == "__main__":
    main()
