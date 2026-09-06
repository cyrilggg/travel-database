#!/usr/bin/env python3
"""Build the UAE city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-uae-city-centers.py <AE.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "CB3D6AD67234DD9CEE04DE8D38E0E27743669F2E1C6F20121F7D7497D65B61DA"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 17,
    "PPLA": 6,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "ae-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "阿布扎比酋长国",
    "02": "阿治曼酋长国",
    "03": "迪拜酋长国",
    "04": "富查伊拉酋长国",
    "05": "哈伊马角酋长国",
    "06": "沙迦酋长国",
    "07": "乌姆盖万酋长国",
}
ADMIN_AREA_OVERRIDES = {
    # GeoNames places Dibba Al-Hisn under Fujairah; it is a Sharjah exclave.
    "292239": "沙迦酋长国",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "emirate_capital",
    "PPLA2": "second_order_administrative_seat",
    "PPLA3": "third_order_administrative_seat",
    "PPLA4": "local_administrative_seat",
    "PPL": "populated_place_5000_plus",
}

EXCLUDED_GEONAMES_IDS = {
    # Abu Dhabi internal suburbs, planned communities, and industrial districts.
    "12047416",  # Al Shamkhah City
    "12042052",  # Bani Yas City
    "8057551",  # Khalifah A City
    "13118448",  # Masdar City
    "13118447",  # Mohammed Bin Zayed City
    "12042053",  # Musaffah
    # Dubai internal districts and master-planned communities.
    "7289825",  # Bur Dubai
    "13118430",  # DAMAC Hills
    "13118429",  # Dubai Motor City
    "11524601",  # Jebel Ali
    "6691113",  # The Palm Jumeirah
    "290503",  # Warisan
    # Fujairah and Sharjah internal districts or duplicate urban centers.
    "12047417",  # Reef Al Fujairah City
    "290680",  # Tarif Kalba; retain Kalba (291763)
    "13118438",  # Al Sajaah
    "13118437",  # Halwan
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
        raise SystemExit(f"GeoNames 阿联酋快照哈希变化：{actual_hash}")

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
        admin_area = ADMIN_AREA_OVERRIDES.get(
            geonames_id, ADMIN_AREA_NAMES.get(place[10])
        )
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的酋长国代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (51.4 <= longitude <= 56.5 and 22.5 <= latitude <= 26.2):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出阿联酋范围")

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
        raise SystemExit(f"阿联酋城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 24:
        raise SystemExit(f"阿联酋城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("阿联酋七个酋长国覆盖发生变化")

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
            "用法：py -3.12 scripts/import-uae-city-centers.py <AE.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 24 个阿联酋城市级中心点")


if __name__ == "__main__":
    main()
