#!/usr/bin/env python3
"""Build Kyrgyzstan's current statutory city catalog from the SOATE appendix.

Usage:
  py -3.12 scripts/import-kyrgyzstan-soate-cities.py \
    <GK-SOATE-2025.pdf> <KG.txt> [output.csv]

The 34 codes and names below transcribe Appendix 2 of the pinned official
classifier. The snapshot already reflects the 2025 Manas rename and the
addition of Gulcho as a district-significance city.
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


EXPECTED_SOATE_HASH = (
    "0B2178EDCDB79F0E257DDAE6AFA7DF4F55E85E3BF5BA77D18C4589940C7800DD"
)
EXPECTED_GEONAMES_HASH = (
    "46F974ED681830E83B5660BBCA64E35FF6C98AA6CE4921DCE593C38FE4E4D6B5"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "kg-soate-cities-2025-10.csv"
)

# code, display name, official Russian name, admin area, GeoNames admin1, level
CITIES = [
    ("41711000000000", "Bishkek", "Бишкек", "Bishkek", "01", "republican_significance_city"),
    ("41721000000000", "Osh", "Ош", "Osh", "08", "republican_significance_city"),
    ("41702410000010", "Karakol", "Каракол", "Issyk-Kul Region", "07", "regional_significance_city"),
    ("41702420000010", "Balykchy", "Балыкчы", "Issyk-Kul Region", "07", "regional_significance_city"),
    ("41703410000010", "Manas", "Манас", "Jalal-Abad Region", "03", "regional_significance_city"),
    ("41703420000010", "Tash-Kumyr", "Таш-Кумыр", "Jalal-Abad Region", "03", "regional_significance_city"),
    ("41703430000010", "Mailuu-Suu", "Майлуу-Суу", "Jalal-Abad Region", "03", "regional_significance_city"),
    ("41703440000010", "Kara-Kul", "Кара-Куль", "Jalal-Abad Region", "03", "regional_significance_city"),
    ("41704400000010", "Naryn", "Нарын", "Naryn Region", "04", "regional_significance_city"),
    ("41705410000010", "Batken", "Баткен", "Batken Region", "09", "regional_significance_city"),
    ("41705420000010", "Suluktu", "Сулюкта", "Batken Region", "09", "regional_significance_city"),
    ("41705430000010", "Kyzyl-Kyya", "Кызыл-Кия", "Batken Region", "09", "regional_significance_city"),
    ("41707400000010", "Talas", "Талас", "Talas Region", "06", "regional_significance_city"),
    ("41708400000010", "Tokmok", "Токмок", "Chuy Region", "02", "regional_significance_city"),
    ("41708410000010", "Kant", "Кант", "Chuy Region", "02", "regional_significance_city"),
    ("41708420000010", "Kara-Balta", "Кара-Балта", "Chuy Region", "02", "regional_significance_city"),
    ("41702215600010", "Cholpon-Ata", "Чолпон-Ата", "Issyk-Kul Region", "07", "district_significance_city"),
    ("41703207600010", "Bazar-Korgon", "Базар-Коргон", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41703211610010", "Kerben", "Кербен", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41703215600010", "Kochkor-Ata", "Кочкор-Ата", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41703215600020", "Shamaldy-Say", "Шамалды-Сай", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41703220600010", "Kok-Jangak", "Кок-Джангак", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41703225600010", "Toktogul", "Токтогул", "Jalal-Abad Region", "03", "district_significance_city"),
    ("41705236610010", "Razzakov", "Раззаков", "Batken Region", "09", "district_significance_city"),
    ("41705258600010", "Aydarken", "Айдаркен", "Batken Region", "09", "district_significance_city"),
    ("41705258610020", "Kadamjay", "Кадамжай", "Batken Region", "09", "district_significance_city"),
    ("41706207600010", "Gulcho", "Гульчо", "Osh Region", "08", "district_significance_city"),
    ("41706226600010", "Kara-Suu", "Кара-Суу", "Osh Region", "08", "district_significance_city"),
    ("41706255600010", "Uzgen", "Узген", "Osh Region", "08", "district_significance_city"),
    ("41706242600010", "Nookat", "Ноокат", "Osh Region", "08", "district_significance_city"),
    ("41708213600010", "Orlovka", "Орловка", "Chuy Region", "02", "district_significance_city"),
    ("41708213610020", "Kemin", "Кемин", "Chuy Region", "02", "district_significance_city"),
    ("41708219600010", "Kayyngdy", "Кайынды", "Chuy Region", "02", "district_significance_city"),
    ("41708222600010", "Shopokov", "Шопоков", "Chuy Region", "02", "district_significance_city"),
]

EXPECTED_LEVEL_COUNTS = {
    "republican_significance_city": 2,
    "regional_significance_city": 14,
    "district_significance_city": 18,
}

# Current legal names not yet used as the primary name in GeoNames.
POINT_OVERRIDES = {
    "41703410000010": "1528249",  # Manas / former Jalal-Abad
    "41706207600010": "1528320",  # Gulcho / Gulcha
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


def parse_geonames(path: Path) -> tuple[dict[str, dict[str, object]], dict[tuple[str, str], list[dict[str, object]]]]:
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
    counts = Counter(city[5] for city in CITIES)
    if len(CITIES) != 34 or counts != EXPECTED_LEVEL_COUNTS:
        raise SystemExit(f"SOATE 城市清单分类变化：{dict(sorted(counts.items()))}")
    if len({city[0] for city in CITIES}) != len(CITIES):
        raise SystemExit("SOATE 城市稳定 ID 重复")

    output = []
    for code, display_name, official_name, admin_area, admin1, city_level in CITIES:
        override = POINT_OVERRIDES.get(code)
        if override:
            point = by_id.get(override)
            if point is None:
                raise SystemExit(f"固定中心点不存在：{code} -> {override}")
        else:
            candidates: dict[str, dict[str, object]] = {}
            for name in (display_name, official_name):
                for point in by_admin_and_name.get((admin1, normalized_name(name)), []):
                    candidates[str(point["id"])] = point
            if not candidates:
                raise SystemExit(f"城市没有行政区内精确中心点：{code} / {display_name}")
            point = max(candidates.values(), key=point_rank)

        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (69 <= longitude <= 81 and 39 <= latitude <= 44):
            raise SystemExit(f"{code} / {display_name} 中心点超出吉尔吉斯斯坦范围")
        output.append(
            {
                "administrative_code": code,
                "name": display_name,
                "admin_area": admin_area,
                "city_level": city_level,
                "geonames_id": str(point["id"]),
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    for field, values in (
        ("稳定 ID", [row["administrative_code"] for row in output]),
        ("GeoNames ID", [row["geonames_id"] for row in output]),
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
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-kyrgyzstan-soate-cities.py "
            "<GK-SOATE-2025.pdf> <KG.txt> [output.csv]"
        )
    soate_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    require_hash(soate_path, EXPECTED_SOATE_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    by_id, by_admin_and_name = parse_geonames(geonames_path)
    rows = build_rows(by_id, by_admin_and_name)
    write_csv(rows, output_path)
    print("已生成 34 个吉尔吉斯斯坦法定城市中心点（2/14/18）")


if __name__ == "__main__":
    main()
