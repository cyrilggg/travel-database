#!/usr/bin/env python3
"""Build Armenia's current statutory city catalog from the current law annex.

Usage:
  py -3.12 scripts/import-armenia-statutory-cities.py \
    <administrative-territorial-law.html> <AM.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import html
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path


EXPECTED_LAW_HASH = (
    "A5C9DBF418C3AF4D3395BEFFE848D4B4E6952D884ED76EAA203C6085FFE67040"
)
EXPECTED_GEONAMES_HASH = (
    "B71FF40F3520FEF61F11B874E19C1D9567348489E3FAD625681E2D58611BDA75"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "am-statutory-cities-2026-09-06.csv"
)

# official Armenian name, display name, marz, GeoNames admin1, level
CITIES = [
    ("Աշտարակ", "Ashtarak", "Aragatsotn", "01", "statutory_city"),
    ("Ապարան", "Aparan", "Aragatsotn", "01", "statutory_city"),
    ("Թալին", "Talin", "Aragatsotn", "01", "statutory_city"),
    ("Արտաշատ", "Artashat", "Ararat", "02", "statutory_city"),
    ("Արարատ", "Ararat", "Ararat", "02", "statutory_city"),
    ("Մասիս", "Masis", "Ararat", "02", "statutory_city"),
    ("Վեդի", "Vedi", "Ararat", "02", "statutory_city"),
    ("Արմավիր", "Armavir", "Armavir", "03", "statutory_city"),
    ("Էջմիածին", "Vagharshapat", "Armavir", "03", "statutory_city"),
    ("Մեծամոր", "Metsamor", "Armavir", "03", "statutory_city"),
    ("Գավառ", "Gavar", "Gegharkunik", "04", "statutory_city"),
    ("Ճամբարակ", "Chambarak", "Gegharkunik", "04", "statutory_city"),
    ("Մարտունի", "Martuni", "Gegharkunik", "04", "statutory_city"),
    ("Սևան", "Sevan", "Gegharkunik", "04", "statutory_city"),
    ("Վարդենիս", "Vardenis", "Gegharkunik", "04", "statutory_city"),
    ("Վանաձոր", "Vanadzor", "Lori", "06", "statutory_city"),
    ("Ալավերդի", "Alaverdi", "Lori", "06", "statutory_city"),
    ("Ախթալա", "Akhtala", "Lori", "06", "statutory_city"),
    ("Շամլուղ", "Shamlugh", "Lori", "06", "statutory_city"),
    ("Թումանյան", "Tumanyan", "Lori", "06", "statutory_city"),
    ("Սպիտակ", "Spitak", "Lori", "06", "statutory_city"),
    ("Ստեփանավան", "Stepanavan", "Lori", "06", "statutory_city"),
    ("Տաշիր", "Tashir", "Lori", "06", "statutory_city"),
    ("Հրազդան", "Hrazdan", "Kotayk", "05", "statutory_city"),
    ("Աբովյան", "Abovyan", "Kotayk", "05", "statutory_city"),
    ("Բյուրեղավան", "Byureghavan", "Kotayk", "05", "statutory_city"),
    ("Եղվարդ", "Yeghvard", "Kotayk", "05", "statutory_city"),
    ("Ծաղկաձոր", "Tsaghkadzor", "Kotayk", "05", "statutory_city"),
    ("Նոր Հաճն", "Nor Hachn", "Kotayk", "05", "statutory_city"),
    ("Չարենցավան", "Charentsavan", "Kotayk", "05", "statutory_city"),
    ("Գյումրի", "Gyumri", "Shirak", "07", "statutory_city"),
    ("Արթիկ", "Artik", "Shirak", "07", "statutory_city"),
    ("Մարալիկ", "Maralik", "Shirak", "07", "statutory_city"),
    ("Կապան", "Kapan", "Syunik", "08", "statutory_city"),
    ("Գորիս", "Goris", "Syunik", "08", "statutory_city"),
    ("Մեղրի", "Meghri", "Syunik", "08", "statutory_city"),
    ("Ագարակ", "Agarak", "Syunik", "08", "statutory_city"),
    ("Սիսիան", "Sisian", "Syunik", "08", "statutory_city"),
    ("Դաստակերտ", "Dastakert", "Syunik", "08", "statutory_city"),
    ("Քաջարան", "Kajaran", "Syunik", "08", "statutory_city"),
    ("Եղեգնաձոր", "Yeghegnadzor", "Vayots Dzor", "10", "statutory_city"),
    ("Ջերմուկ", "Jermuk", "Vayots Dzor", "10", "statutory_city"),
    ("Վայք", "Vayk", "Vayots Dzor", "10", "statutory_city"),
    ("Իջևան", "Ijevan", "Tavush", "09", "statutory_city"),
    ("Բերդ", "Berd", "Tavush", "09", "statutory_city"),
    ("Դիլիջան", "Dilijan", "Tavush", "09", "statutory_city"),
    ("Նոյեմբերյան", "Noyemberyan", "Tavush", "09", "statutory_city"),
    ("Այրում", "Ayrum", "Tavush", "09", "statutory_city"),
    ("Երևան", "Yerevan", "Yerevan", "11", "capital_city"),
]

POINT_OVERRIDES: dict[str, str] = {}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.fragments: list[str] = []

    def handle_data(self, data: str) -> None:
        self.fragments.extend(data.splitlines())


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


def validate_law(path: Path) -> None:
    extractor = TextExtractor()
    extractor.feed(path.read_text(encoding="utf-8"))
    lines = [
        re.sub(r"\s+", " ", html.unescape(fragment)).strip()
        for fragment in extractor.fragments
    ]
    armenian_city_pattern = re.compile(r"^([Ա-Ֆա-ֆև ]+) քաղաք$")
    official = {
        match.group(1)
        for line in lines
        if (match := armenian_city_pattern.fullmatch(line))
    }
    expected = {city[0] for city in CITIES if city[4] == "statutory_city"}
    if official != expected:
        raise SystemExit(
            f"现行法律城市清单不一致：缺少 {sorted(official - expected)}，"
            f"多出 {sorted(expected - official)}"
        )


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
    if len(CITIES) != 49 or Counter(city[4] for city in CITIES) != {
        "statutory_city": 48,
        "capital_city": 1,
    }:
        raise SystemExit("现行法定城市数量变化")

    output: list[dict[str, str]] = []
    unresolved: list[str] = []
    for official_name, name, admin_area, admin1, city_level in CITIES:
        override = POINT_OVERRIDES.get(name)
        if override:
            point = by_id.get(override)
            if point is None:
                raise SystemExit(f"固定中心点不存在：{name} -> {override}")
        else:
            candidates: dict[str, dict[str, object]] = {}
            for candidate_name in (official_name, name):
                for point_value in by_admin_and_name.get(
                    (admin1, normalized_name(candidate_name)), []
                ):
                    candidates[str(point_value["id"])] = point_value
            if not candidates:
                unresolved.append(f"{official_name}\t{name}\t{admin_area}")
                continue
            point = max(candidates.values(), key=point_rank)

        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (43 <= longitude <= 47 and 38 <= latitude <= 42):
            raise SystemExit(f"{name} 中心点超出亚美尼亚范围")
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
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-armenia-statutory-cities.py "
            "<administrative-territorial-law.html> <AM.txt> [output.csv]"
        )
    law_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    require_hash(law_path, EXPECTED_LAW_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    validate_law(law_path)
    by_id, by_admin_and_name = parse_geonames(geonames_path)
    rows = build_rows(by_id, by_admin_and_name)
    write_csv(rows, output_path)
    print("已生成 49 个亚美尼亚现行法定城市中心点（48 + Yerevan）")


if __name__ == "__main__":
    main()
