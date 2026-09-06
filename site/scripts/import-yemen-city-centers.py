#!/usr/bin/env python3
"""Build Yemen's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-yemen-city-centers.py <YE.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "4622489F8B9F293ECB88A5A9EB3D87E004C828E9130F95D666053D6221E4F4FA"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 4,
    "PPLA": 19,
    "PPLA2": 262,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "ye-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "阿比扬省",
    "02": "亚丁省",
    "03": "马赫拉省",
    "04": "哈德拉毛省",
    "05": "舍卜沃省",
    "08": "荷台达省",
    "10": "马哈维特省",
    "11": "扎玛尔省",
    "14": "马里卜省",
    "15": "萨达省",
    "16": "萨那省",
    "18": "达利省",
    "19": "阿姆兰省",
    "20": "贝达省",
    "21": "焦夫省",
    "22": "哈杰省",
    "23": "伊卜省",
    "24": "拉赫季省",
    "25": "塔伊兹省",
    "26": "首都省",
    "27": "赖马省",
    "28": "索科特拉省",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "governorate_capital",
    "PPLA2": "district_seat",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

EXCLUDED_GEONAMES_IDS = {
    # Aden's seven district centers are neighborhoods of the same city.
    "79799",  # Al Burayqah
    "73422",  # Al Mualla
    "78931",  # Al Mansurah
    "77940",  # Ash Shaykh Uthman
    "77662",  # At Tawahi
    "73656",  # Crater
    "73786",  # Khawr Maksar
    # Internal Sana'a city district centers; retain the national capital point.
    "78137",  # Ar Rawdah
    "78708",  # Qaryat al Qabil
    # Administrative duplicate of the retained historic Shibam city point.
    "7792750",  # Suhayl Shibam
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
        raise SystemExit(f"GeoNames 也门快照哈希变化：{actual_hash}")

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
        if not (41.5 <= longitude <= 54.8 and 12.0 <= latitude <= 19.1):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出也门范围")

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
        raise SystemExit(f"也门城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 286:
        raise SystemExit(f"也门城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("也门 22 个省级地区覆盖发生变化")

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
            "用法：py -3.12 scripts/import-yemen-city-centers.py <YE.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 286 个也门城市级中心点")


if __name__ == "__main__":
    main()
