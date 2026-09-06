#!/usr/bin/env python3
"""Build Montenegro's physical city/town catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-montenegro-city-centers.py <ME.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "B40769DC867BA233C10F4C8E2449D571B6360C048F31F98BF3C9B7D680435440"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 16,
    "PPLA": 24,
    "PPLC": 1,
    "PPLL": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "me-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "安德里耶维察市镇",
    "02": "巴尔市镇",
    "03": "贝拉内市镇",
    "04": "比耶洛波列市镇",
    "05": "布德瓦市镇",
    "06": "采蒂涅市镇",
    "07": "达尼洛夫格勒市镇",
    "08": "新海尔采格市镇",
    "09": "科拉欣市镇",
    "10": "科托尔市镇",
    "11": "莫伊科瓦茨市镇",
    "12": "尼克希奇市镇",
    "13": "普拉夫市镇",
    "14": "普列夫利亚市镇",
    "15": "普卢日内市镇",
    "16": "波德戈里察市",
    "17": "罗扎伊市镇",
    "18": "沙夫尼克市镇",
    "19": "蒂瓦特市镇",
    "20": "乌尔齐尼市镇",
    "21": "扎布利亚克市镇",
    "22": "古西涅市镇",
    "23": "佩特尼察市镇",
    "24": "图齐市镇",
    "25": "泽塔市镇",
}

# The 25 current local-government seats are combined with 17 physically
# separate towns from MONSTAT's 2011 urban-settlement table. Constituents of
# the continuous Bijelo Polje urban core are represented by one city point.
CITY_NAMES = {
    "786234": "Rožaje",
    "3186616": "Zelenika",
    "3186999": "Žabljak",
    "3187691": "Virpazar",
    "3188516": "Ulcinj",
    "3188584": "Tuzi",
    "3189073": "Tivat",
    "3189282": "Sveti Stefan",
    "3189429": "Sutomore",
    "3189979": "Stari Bar",
    "3190178": "Spuž",
    "3191222": "Šavnik",
    "3191631": "Risan",
    "3191646": "Rijeka Crnojevića",
    "3192576": "Prčanj",
    "3193044": "Podgorica",
    "3193131": "Plužine",
    "3193161": "Pljevlja",
    "3193228": "Plav",
    "3193413": "Petrovac na Moru",
    "3193504": "Perast",
    "3194494": "Nikšić",
    "3194926": "Mojkovac",
    "3197538": "Kotor",
    "3197896": "Kolašin",
    "3199071": "Berane",
    "3199161": "Igalo",
    "3199394": "Herceg Novi",
    "3199463": "Gusinje",
    "3200422": "Golubovci",
    "3201675": "Donja Lastva",
    "3201903": "Dobrota",
    "3202194": "Danilovgrad",
    "3202641": "Cetinje",
    "3203106": "Budva",
    "3204176": "Bijelo Polje",
    "3204214": "Bijela",
    "3204388": "Bečići",
    "3204509": "Bar",
    "3204816": "Andrijevica",
    "3220594": "Petnjica",
    "3318571": "Donji Gradac",
}

MUNICIPAL_SEAT_IDS = {
    "786234", "3186999", "3188516", "3188584", "3189073", "3191222",
    "3193044", "3193131", "3193161", "3193228", "3194494", "3194926",
    "3197538", "3197896", "3199071", "3199394", "3199463", "3200422",
    "3202194", "3202641", "3203106", "3204176", "3204509", "3204816",
    "3220594",
}

ADMIN_AREA_OVERRIDES = {
    "3189282": "布德瓦市镇",
    "3204388": "布德瓦市镇",
    # GeoNames stores the official urban settlement Gradac as Donji Gradac.
    "3318571": "普列夫利亚市镇",
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
        raise SystemExit(f"GeoNames 黑山快照哈希变化：{actual_hash}")

    places = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) >= 19 and values[0] in CITY_NAMES:
                places[values[0]] = values

    missing = sorted(set(CITY_NAMES) - set(places))
    if missing:
        raise SystemExit(f"GeoNames 快照缺少黑山城市：{missing}")
    for geonames_id, expected_name in CITY_NAMES.items():
        actual_name = places[geonames_id][1]
        if actual_name != expected_name:
            raise SystemExit(
                f"GeoNames 城市名称变化：{geonames_id} {actual_name} != {expected_name}"
            )
    return list(places.values())


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin_area = ADMIN_AREA_OVERRIDES.get(geonames_id)
        if admin_area is None:
            admin_area = ADMIN_AREA_NAMES.get(place[10])
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的市镇代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (18.4 <= longitude <= 20.4 and 41.8 <= latitude <= 43.6):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出黑山范围")

        if feature_code == "PPLC":
            city_level = "country_capital"
        elif geonames_id in MUNICIPAL_SEAT_IDS:
            city_level = "municipal_seat"
        else:
            city_level = "official_urban_town"

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
        raise SystemExit(f"黑山来源层级数量变化：{dict(feature_counts)}")
    if len(rows) != 42:
        raise SystemExit(f"黑山实体城市与城镇数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("黑山 25 个市镇驻地覆盖发生变化")

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
            "用法：py -3.12 scripts/import-montenegro-city-centers.py <ME.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 42 个黑山实体城市与城镇中心点")


if __name__ == "__main__":
    main()
