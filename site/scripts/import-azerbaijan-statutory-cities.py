#!/usr/bin/env python3
"""Build Azerbaijan's current statutory city catalog.

Usage:
  py -3.12 scripts/import-azerbaijan-statutory-cities.py \
    <administrative-divisions-2025.xls> <AZ.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import xlrd


EXPECTED_DIVISIONS_HASH = (
    "88593D2C4FE8C4338D32B025BFA66A21F75BB5B6D11EDC7954D005C26C75CD6B"
)
EXPECTED_GEONAMES_HASH = (
    "B695685D6A41C074381D581433E78CB5B25569F9AF9C6BFD4C541FD25841D5C0"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "az-statutory-cities-2026-09-06.csv"
)

# Official Azerbaijani name, display name, containing administrative unit, level.
# The names follow the 2024 Administrative-Territorial Division Classifier; the
# 2025 statistical workbook independently confirms the current national total.
CITIES = [
    ("Ağcabədi", "Aghjabadi", "Aghjabadi District", "district_subordinate_city"),
    ("Ağdam", "Aghdam", "Aghdam District", "district_subordinate_city"),
    ("Ağdaş", "Agdash", "Agdash District", "district_subordinate_city"),
    ("Ağdərə", "Aghdara", "Aghdara District", "district_subordinate_city"),
    ("Ağstafa", "Aghstafa", "Aghstafa District", "district_subordinate_city"),
    ("Ağsu", "Aghsu", "Aghsu District", "district_subordinate_city"),
    ("Astara", "Astara", "Astara District", "district_subordinate_city"),
    ("Babək", "Babek", "Babek District", "district_subordinate_city"),
    ("Bakı", "Baku", "Baku", "republic_subordinate_city"),
    ("Balakən", "Balakan", "Balakan District", "district_subordinate_city"),
    ("Beyləqan", "Beylagan", "Beylagan District", "district_subordinate_city"),
    ("Bərdə", "Barda", "Barda District", "district_subordinate_city"),
    ("Biləsuvar", "Bilasuvar", "Bilasuvar District", "district_subordinate_city"),
    ("Cəbrayıl", "Jabrayil", "Jabrayil District", "district_subordinate_city"),
    ("Cəlilabad", "Jalilabad", "Jalilabad District", "district_subordinate_city"),
    ("Culfa", "Julfa", "Julfa District", "district_subordinate_city"),
    ("Daşkəsən", "Dashkasan", "Dashkasan District", "district_subordinate_city"),
    ("Dəliməmmədli", "Dalimammadli", "Goranboy District", "district_subordinate_city"),
    ("Füzuli", "Fuzuli", "Fuzuli District", "district_subordinate_city"),
    ("Gədəbəy", "Gadabay", "Gadabay District", "district_subordinate_city"),
    ("Gəncə", "Ganja", "Ganja", "republic_subordinate_city"),
    ("Goranboy", "Goranboy", "Goranboy District", "district_subordinate_city"),
    ("Göyçay", "Goychay", "Goychay District", "district_subordinate_city"),
    ("Göygöl", "Goygol", "Goygol District", "district_subordinate_city"),
    ("Göytəpə", "Goytepe", "Jalilabad District", "district_subordinate_city"),
    ("Hacıqabul", "Hajigabul", "Hajigabul District", "district_subordinate_city"),
    ("Horadiz", "Horadiz", "Fuzuli District", "district_subordinate_city"),
    ("Xaçmaz", "Khachmaz", "Khachmaz District", "district_subordinate_city"),
    ("Xankəndi", "Khankendi", "Khankendi", "republic_subordinate_city"),
    ("Xızı", "Khizi", "Khizi District", "district_subordinate_city"),
    ("Xocalı", "Khojaly", "Khojaly District", "district_subordinate_city"),
    ("Xocavənd", "Khojavend", "Khojavend District", "district_subordinate_city"),
    ("Xırdalan", "Khirdalan", "Absheron District", "district_subordinate_city"),
    ("Xudat", "Khudat", "Khachmaz District", "district_subordinate_city"),
    ("İmişli", "Imishli", "Imishli District", "district_subordinate_city"),
    ("İsmayıllı", "Ismayilli", "Ismayilli District", "district_subordinate_city"),
    ("Kəlbəcər", "Kalbajar", "Kalbajar District", "district_subordinate_city"),
    ("Kürdəmir", "Kurdamir", "Kurdamir District", "district_subordinate_city"),
    ("Qax", "Qakh", "Qakh District", "district_subordinate_city"),
    ("Qazax", "Qazakh", "Qazakh District", "district_subordinate_city"),
    ("Qəbələ", "Qabala", "Qabala District", "district_subordinate_city"),
    ("Qobustan", "Gobustan", "Gobustan District", "district_subordinate_city"),
    ("Qovlar", "Qovlar", "Tovuz District", "district_subordinate_city"),
    ("Quba", "Quba", "Quba District", "district_subordinate_city"),
    ("Qubadlı", "Qubadli", "Qubadli District", "district_subordinate_city"),
    ("Qusar", "Qusar", "Qusar District", "district_subordinate_city"),
    ("Laçın", "Lachin", "Lachin District", "district_subordinate_city"),
    ("Lerik", "Lerik", "Lerik District", "district_subordinate_city"),
    ("Lənkəran", "Lankaran", "Lankaran District", "republic_subordinate_city"),
    ("Liman", "Liman", "Lankaran District", "district_subordinate_city"),
    ("Masallı", "Masalli", "Masalli District", "district_subordinate_city"),
    ("Mingəçevir", "Mingachevir", "Mingachevir", "republic_subordinate_city"),
    ("Naftalan", "Naftalan", "Naftalan", "republic_subordinate_city"),
    ("Naxçıvan", "Nakhchivan", "Nakhchivan", "republic_subordinate_city"),
    ("Neftçala", "Neftchala", "Neftchala District", "district_subordinate_city"),
    ("Oğuz", "Oghuz", "Oghuz District", "district_subordinate_city"),
    ("Ordubad", "Ordubad", "Ordubad District", "district_subordinate_city"),
    ("Saatlı", "Saatli", "Saatli District", "district_subordinate_city"),
    ("Sabirabad", "Sabirabad", "Sabirabad District", "district_subordinate_city"),
    ("Salyan", "Salyan", "Salyan District", "district_subordinate_city"),
    ("Samux", "Samukh", "Samukh District", "district_subordinate_city"),
    ("Siyəzən", "Siyazan", "Siyazan District", "district_subordinate_city"),
    ("Sumqayıt", "Sumgayit", "Sumgayit", "republic_subordinate_city"),
    ("Şabran", "Shabran", "Shabran District", "district_subordinate_city"),
    ("Şahbuz", "Shahbuz", "Shahbuz District", "district_subordinate_city"),
    ("Şamaxı", "Shamakhi", "Shamakhi District", "district_subordinate_city"),
    ("Şəki", "Sheki", "Sheki District", "republic_subordinate_city"),
    ("Şəmkir", "Shamkir", "Shamkir District", "district_subordinate_city"),
    ("Şərur", "Sharur", "Sharur District", "district_subordinate_city"),
    ("Şirvan", "Shirvan", "Shirvan", "republic_subordinate_city"),
    ("Şuşa", "Shusha", "Shusha District", "district_subordinate_city"),
    ("Tərtər", "Tartar", "Tartar District", "district_subordinate_city"),
    ("Tovuz", "Tovuz", "Tovuz District", "district_subordinate_city"),
    ("Ucar", "Ujar", "Ujar District", "district_subordinate_city"),
    ("Yardımlı", "Yardimli", "Yardimli District", "district_subordinate_city"),
    ("Yevlax", "Yevlakh", "Yevlakh District", "republic_subordinate_city"),
    ("Zaqatala", "Zaqatala", "Zaqatala District", "district_subordinate_city"),
    ("Zəngilan", "Zangilan", "Zangilan District", "district_subordinate_city"),
    ("Zərdab", "Zardab", "Zardab District", "district_subordinate_city"),
]

POINT_OVERRIDES: dict[str, str] = {
    # Qobustan is the district capital formerly named Maraza, not the larger
    # same-named settlement inside Baku's Qaradagh district.
    "Gobustan": "585570",
    # Liman city is the former Port-Ilich on the Caspian coast south of Lankaran.
    "Liman": "147316",
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
    value = unicodedata.normalize("NFKD", value).casefold()
    return "".join(character for character in value if character.isalnum())


def numeric_cell(value: object) -> int:
    if isinstance(value, (float, int)):
        return int(value)
    return 0


def validate_divisions(path: Path) -> None:
    workbook = xlrd.open_workbook(path)
    if workbook.nsheets != 1:
        raise SystemExit(f"官方行政区划工作簿工作表数量变化：{workbook.nsheets}")
    sheet = workbook.sheet_by_index(0)
    national_rows = [
        row
        for row in range(sheet.nrows)
        if str(sheet.cell_value(row, 1)).strip() == "Azərbaycan Respublikası"
    ]
    if national_rows != [5]:
        raise SystemExit(f"无法定位官方全国汇总行：{national_rows}")
    row = national_rows[0]
    actual = {
        "districts": numeric_cell(sheet.cell_value(row, 2)),
        "city_districts": numeric_cell(sheet.cell_value(row, 3)),
        "cities": numeric_cell(sheet.cell_value(row, 4)),
        "settlements": numeric_cell(sheet.cell_value(row, 6)),
    }
    expected = {
        "districts": 64,
        "city_districts": 12,
        "cities": 79,
        "settlements": 263,
    }
    if actual != expected:
        raise SystemExit(f"官方全国行政区划汇总变化：{actual}")


def parse_geonames(
    path: Path,
) -> tuple[dict[str, dict[str, object]], dict[str, list[dict[str, object]]]]:
    by_id: dict[str, dict[str, object]] = {}
    by_name: dict[str, list[dict[str, object]]] = defaultdict(list)
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
                "population": int(values[14] or 0),
            }
            by_id[values[0]] = place
            for name in {values[1], values[2], *values[3].split(",")}:
                key = normalized_name(name)
                if key:
                    by_name[key].append(place)
    return by_id, by_name


def point_rank(place: dict[str, object]) -> tuple[int, int, int]:
    important = int(str(place["feature_code"]) in {"PPLC", "PPLA", "PPLA2", "PPLA3"})
    return int(place["population"]), important, int(place["id"])


def build_rows(
    by_id: dict[str, dict[str, object]],
    by_name: dict[str, list[dict[str, object]]],
) -> list[dict[str, str]]:
    if len(CITIES) != 79 or Counter(city[3] for city in CITIES) != {
        "district_subordinate_city": 68,
        "republic_subordinate_city": 11,
    }:
        raise SystemExit("现行法定城市数量或等级构成变化")

    output: list[dict[str, str]] = []
    unresolved: list[str] = []
    for official_name, name, admin_area, city_level in CITIES:
        override = POINT_OVERRIDES.get(name)
        if override:
            point = by_id.get(override)
            if point is None:
                raise SystemExit(f"固定中心点不存在：{name} -> {override}")
        else:
            candidates: dict[str, dict[str, object]] = {}
            for candidate_name in (official_name, name):
                for point_value in by_name.get(normalized_name(candidate_name), []):
                    candidates[str(point_value["id"])] = point_value
            if not candidates:
                unresolved.append(f"{official_name}\t{name}\t{admin_area}")
                continue
            point = max(candidates.values(), key=point_rank)

        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (44.5 <= longitude <= 51.0 and 38.0 <= latitude <= 42.2):
            raise SystemExit(f"{name} 中心点超出阿塞拜疆范围")
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
        raise SystemExit("城市没有精确中心点：\n" + "\n".join(unresolved))
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
            "用法：py -3.12 scripts/import-azerbaijan-statutory-cities.py "
            "<administrative-divisions-2025.xls> <AZ.txt> [output.csv]"
        )
    divisions_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    require_hash(divisions_path, EXPECTED_DIVISIONS_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    validate_divisions(divisions_path)
    by_id, by_name = parse_geonames(geonames_path)
    rows = build_rows(by_id, by_name)
    write_csv(rows, output_path)
    print("已生成 79 个阿塞拜疆现行法定城市中心点（11 + 68）")


if __name__ == "__main__":
    main()
