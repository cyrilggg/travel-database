#!/usr/bin/env python3
"""Build Saudi Arabia's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-saudi-city-centers.py <SA.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "7974F27B41FCEB564FAA7D95A73BC29BA1A6D78AFDC1B307AFCE288E1DAF3615"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 119,
    "PPLA": 12,
    "PPLA2": 4,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "sa-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "02": "巴哈省",
    "05": "麦地那省",
    "06": "东部省",
    "08": "卡西姆省",
    "10": "利雅得省",
    "11": "阿西尔省",
    "13": "哈伊勒省",
    "14": "麦加省",
    "15": "北部边疆省",
    "16": "奈季兰省",
    "17": "吉赞省",
    "19": "塔布克省",
    "20": "焦夫省",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "region_capital",
    "PPLA2": "governorate_seat",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

EXCLUDED_GEONAMES_IDS = {
    "110059",  # Older duplicate of Al Aqiq; retain 110060.
    "101760",  # Sultanah is part of Medina's continuous urban area.
    "109436",  # Small Al Jubayl point inside the Al Ahsa urban area.
    "104828",  # King Faisal Military City is a military installation.
    "102985",  # Rahimah duplicates the retained Ras Tanura city center.
    "100768",  # Administrative duplicate of retained Unaizah (101732).
    "101312",  # Older duplicate of retained Turaif (101313).
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
        raise SystemExit(f"GeoNames 沙特阿拉伯快照哈希变化：{actual_hash}")

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
                f"{source_name}（{geonames_id}）的行政区代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (34.4 <= longitude <= 55.8 and 16.0 <= latitude <= 32.5):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出沙特阿拉伯范围")

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
        raise SystemExit(f"沙特阿拉伯城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 136:
        raise SystemExit(f"沙特阿拉伯城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("沙特阿拉伯 13 个行政区覆盖发生变化")

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
            "用法：py -3.12 scripts/import-saudi-city-centers.py <SA.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 136 个沙特阿拉伯城市级中心点")


if __name__ == "__main__":
    main()
