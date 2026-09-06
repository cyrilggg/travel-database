#!/usr/bin/env python3
"""Build Bosnia and Herzegovina's city/town catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-bosnia-herzegovina-city-centers.py <BA.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "2CE12DF5CC846F539ADD05158DDFD470390B7DF4F133DEC431245473F933EEEC"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 7,
    "PPLA": 2,
    "PPLA2": 62,
    "PPLA3": 69,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "ba-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "波黑联邦",
    "02": "塞族共和国",
    "BRC": "布尔奇科特区",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3"}

# Independent non-seat towns above 5,000 residents in the GeoNames snapshot.
# Other PPL candidates are villages, Sarajevo/Banja Luka suburbs, or duplicate
# points for a retained administrative center.
ORDINARY_TOWN_IDS = {
    "3187162",  # Vrnograč
    "3191302",  # Sanica
    "3193776",  # Otoka / Bosanska Otoka
    "3193821",  # Ostrožac
    "3194120",  # Omarska
    "3198895",  # Janja
    "3210439",  # Jelah
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
        raise SystemExit(f"GeoNames 波黑快照哈希变化：{actual_hash}")

    places = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P":
                continue
            if values[7] in ADMINISTRATIVE_FEATURES or values[0] in ORDINARY_TOWN_IDS:
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
                f"{source_name}（{geonames_id}）的实体代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (15.7 <= longitude <= 19.7 and 42.5 <= latitude <= 45.3):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出波黑范围")

        city_level = {
            "PPLC": "country_capital",
            "PPLA": "entity_or_district_seat",
            "PPLA2": "municipal_seat",
            "PPLA3": "municipal_seat",
            "PPL": "ordinary_town_5000_plus",
        }[feature_code]
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
        raise SystemExit(f"波黑来源层级数量变化：{dict(feature_counts)}")
    if len(rows) != 141:
        raise SystemExit(f"波黑城市与城镇数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("波黑三个实体级地区覆盖发生变化")

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
            "用法：py -3.12 scripts/import-bosnia-herzegovina-city-centers.py <BA.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 141 个波黑城市与城镇中心点")


if __name__ == "__main__":
    main()
