#!/usr/bin/env python3
"""Build Turkmenistan's current 50-city catalog from the statutory list.

Usage:
  py -3.12 scripts/import-turkmenistan-statutory-cities.py \
    <TM.txt> [output.csv]

The list transcribes the city rows published with the 2022 census and applies
the current spellings and hierarchy confirmed by the Mejlis in 2025/2026.
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "0473C102550AAD307C6D660718DF4BA07D34D97B50597560DF9E807114C5B9A7"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "tm-statutory-cities-2026-09-06.csv"
)

# current name, administrative area, GeoNames admin1, statutory level
CITIES = [
    ("Änew", "Ahal Region", "01", "city_in_district"),
    ("Altyn asyr", "Ahal Region", "01", "city_in_district"),
    ("Arkadag", "Arkadag", "01", "state_significance_city"),
    ("Babadaýhan", "Ahal Region", "01", "city_in_district"),
    ("Bäherden", "Ahal Region", "01", "city_in_district"),
    ("Gökdepe", "Ahal Region", "01", "city_in_district"),
    ("Kaka", "Ahal Region", "01", "city_in_district"),
    ("Sarahs", "Ahal Region", "01", "city_in_district"),
    ("Tejen", "Ahal Region", "01", "city_in_district"),
    ("Ashgabat", "Ashgabat", "S", "province_equivalent_city"),
    ("Balkanabat", "Balkan Region", "02", "district_rights_city"),
    ("Bereket", "Balkan Region", "02", "city_in_district"),
    ("Esenguly", "Balkan Region", "02", "city_in_district"),
    ("Etrek", "Balkan Region", "02", "city_in_district"),
    ("Garabogaz", "Balkan Region", "02", "city_in_district"),
    ("Gyzylarbat", "Balkan Region", "02", "city_in_district"),
    ("Magtymguly", "Balkan Region", "02", "city_in_district"),
    ("Türkmenbaşy", "Balkan Region", "02", "district_rights_city"),
    ("Akdepe", "Daşoguz Region", "03", "city_in_district"),
    ("Andalyp", "Daşoguz Region", "03", "city_in_district"),
    ("Boldumsaz", "Daşoguz Region", "03", "city_in_district"),
    ("Daşoguz", "Daşoguz Region", "03", "district_rights_city"),
    ("Görogly", "Daşoguz Region", "03", "city_in_district"),
    ("Gubadag", "Daşoguz Region", "03", "city_in_district"),
    ("Köneürgenç", "Daşoguz Region", "03", "city_in_district"),
    ("Saparmyrat Türkmenbaşy", "Daşoguz Region", "03", "city_in_district"),
    ("Şabat", "Daşoguz Region", "03", "city_in_district"),
    ("Dänew", "Lebap Region", "04", "city_in_district"),
    ("Darganata", "Lebap Region", "04", "city_in_district"),
    ("Dostluk", "Lebap Region", "04", "city_in_district"),
    ("Farap", "Lebap Region", "04", "city_in_district"),
    ("Garabekewül", "Lebap Region", "04", "city_in_district"),
    ("Gazojak", "Lebap Region", "04", "city_in_district"),
    ("Halaç", "Lebap Region", "04", "city_in_district"),
    ("Hojambaz", "Lebap Region", "04", "city_in_district"),
    ("Kerki", "Lebap Region", "04", "city_in_district"),
    ("Köýtendag", "Lebap Region", "04", "city_in_district"),
    ("Magdanly", "Lebap Region", "04", "city_in_district"),
    ("Sakar", "Lebap Region", "04", "city_in_district"),
    ("Saýat", "Lebap Region", "04", "city_in_district"),
    ("Seýdi", "Lebap Region", "04", "city_in_district"),
    ("Türkmenabat", "Lebap Region", "04", "district_rights_city"),
    ("Baýramaly", "Mary Region", "05", "district_rights_city"),
    ("Mary", "Mary Region", "05", "district_rights_city"),
    ("Murgap", "Mary Region", "05", "city_in_district"),
    ("Sakarçäge", "Mary Region", "05", "city_in_district"),
    ("Serhetabat", "Mary Region", "05", "city_in_district"),
    ("Şatlyk", "Mary Region", "05", "city_in_district"),
    ("Türkmengala", "Mary Region", "05", "city_in_district"),
    ("Ýolöten", "Mary Region", "05", "city_in_district"),
]

EXPECTED_LEVEL_COUNTS = {
    "province_equivalent_city": 1,
    "state_significance_city": 1,
    "district_rights_city": 6,
    "city_in_district": 42,
}

POINT_OVERRIDES = {
    "Şabat": "1514745",
    "Seýdi": "1218420",
    "Sakarçäge": "1218472",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def require_hash(path: Path, expected: str) -> None:
    actual = sha256(path)
    if actual != expected:
        raise SystemExit(f"{path} 快照哈希变化：{actual}")


def normalized_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).lower()
    return "".join(character for character in value if character.isalnum())


def parse_geonames(
    path: Path,
) -> tuple[dict[str, dict[str, object]], dict[tuple[str, str], list[dict[str, object]]]]:
    by_id: dict[str, dict[str, object]] = {}
    by_admin_and_name: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P":
                continue
            place: dict[str, object] = {
                "id": values[0],
                "latitude": values[4],
                "longitude": values[5],
                "feature_code": values[7],
                "admin1": values[10],
                "population": int(values[14] or 0),
            }
            by_id[values[0]] = place
            for name in {values[1], values[2], *values[3].split(",")}:
                key = normalized_name(name)
                if key:
                    by_admin_and_name[(values[10], key)].append(place)
    return by_id, by_admin_and_name


def point_rank(place: dict[str, object]) -> tuple[int, int, int]:
    important = int(str(place["feature_code"]) in {"PPLC", "PPLA", "PPLA2", "PPLA3"})
    return int(place["population"]), important, int(place["id"])


def build_rows(
    by_id: dict[str, dict[str, object]],
    by_admin_and_name: dict[tuple[str, str], list[dict[str, object]]],
) -> list[dict[str, str]]:
    counts = Counter(city[3] for city in CITIES)
    if len(CITIES) != 50 or counts != EXPECTED_LEVEL_COUNTS:
        raise SystemExit(f"法定城市清单层级变化：{dict(sorted(counts.items()))}")
    if len({normalized_name(city[0]) for city in CITIES}) != len(CITIES):
        raise SystemExit("法定城市名称重复")

    output: list[dict[str, str]] = []
    unresolved: list[str] = []
    for name, admin_area, admin1, city_level in CITIES:
        override = POINT_OVERRIDES.get(name)
        if override:
            point = by_id.get(override)
            if point is None:
                raise SystemExit(f"固定中心点不存在：{name} -> {override}")
        else:
            candidates = by_admin_and_name.get((admin1, normalized_name(name)), [])
            if not candidates:
                unresolved.append(f"{name}\t{admin_area}")
                continue
            point = max(candidates, key=point_rank)

        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (52 <= longitude <= 67 and 35 <= latitude <= 43):
            raise SystemExit(f"{name} 中心点超出土库曼斯坦范围")
        output.append(
            {
                "administrative_code": str(point["id"]),
                "name": name,
                "admin_area": admin_area,
                "city_level": city_level,
                "geonames_id": str(point["id"]),
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    if unresolved:
        raise SystemExit("城市没有行政区内精确中心点：\n" + "\n".join(unresolved))
    for field, values in (
        ("稳定 ID", [row["administrative_code"] for row in output]),
        ("中心坐标", [(row["longitude"], row["latitude"]) for row in output]),
    ):
        duplicates = [value for value, count in Counter(values).items() if count > 1]
        if duplicates:
            raise SystemExit(f"生成结果存在重复{field}：{duplicates}")
    return sorted(output, key=lambda row: (row["admin_area"], row["name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    headers = [
        "administrative_code",
        "name",
        "admin_area",
        "city_level",
        "geonames_id",
        "longitude",
        "latitude",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-turkmenistan-statutory-cities.py "
            "<TM.txt> [output.csv]"
        )
    geonames_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    by_id, by_admin_and_name = parse_geonames(geonames_path)
    rows = build_rows(by_id, by_admin_and_name)
    write_csv(rows, output_path)
    print("已生成 50 个土库曼斯坦法定城市中心点（1/1/6/42）")


if __name__ == "__main__":
    main()
