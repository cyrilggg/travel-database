#!/usr/bin/env python3
"""从官方 KATOTTG 与固定 GeoNames 快照生成乌克兰全部法定城市。"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


OFFICIAL_XLSX_SHA256 = "5C5317759B2B90208E9B00338BC3DB3C5E694272A166ACF73F1543B3E18ECBEA"
GEONAMES_SHA256 = "CBBB2F639B03C525A264EE0EACE5996B9FDFF4707DFBC6E4E736E65ACE4EEDF8"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "ua-official-cities-2026-07-07.csv"
)

# KATOTTG first-level code: (Chinese display name, GeoNames admin1 code)
ROOTS = {
    "UA01000000000013043": ("克里米亚自治共和国", "11"),
    "UA05000000000010236": ("文尼察州", "23"),
    "UA07000000000024379": ("沃伦州", "24"),
    "UA12000000000090473": ("第聂伯罗彼得罗夫斯克州", "04"),
    "UA14000000000091971": ("顿涅茨克州", "05"),
    "UA18000000000041385": ("日托米尔州", "27"),
    "UA21000000000011690": ("外喀尔巴阡州", "25"),
    "UA23000000000064947": ("扎波罗热州", "26"),
    "UA26000000000069363": ("伊万诺-弗兰科夫斯克州", "06"),
    "UA32000000000030281": ("基辅州", "13"),
    "UA35000000000016081": ("基洛沃格勒州", "10"),
    "UA44000000000018893": ("卢甘斯克州", "14"),
    "UA46000000000026241": ("利沃夫州", "15"),
    "UA48000000000039575": ("尼古拉耶夫州", "16"),
    "UA51000000000030770": ("敖德萨州", "17"),
    "UA53000000000028050": ("波尔塔瓦州", "18"),
    "UA56000000000066151": ("罗夫诺州", "19"),
    "UA59000000000057109": ("苏梅州", "21"),
    "UA61000000000060328": ("捷尔诺波尔州", "22"),
    "UA63000000000041885": ("哈尔科夫州", "07"),
    "UA65000000000030969": ("赫尔松州", "08"),
    "UA68000000000099709": ("赫梅利尼茨基州", "09"),
    "UA71000000000010357": ("切尔卡瑟州", "01"),
    "UA73000000000044923": ("切尔诺夫策州", "03"),
    "UA74000000000025378": ("切尔尼戈夫州", "02"),
    "UA80000000000093317": ("基辅市", "12"),
    "UA85000000000065278": ("塞瓦斯托波尔市", "20"),
}

FEATURE_RANK = {
    "PPLC": 9,
    "PPLA": 8,
    "PPLA2": 7,
    "PPLA3": 6,
    "PPLA4": 5,
    "PPL": 4,
    "PPLX": 3,
    "PPLQ": 2,
    "PPLH": 1,
}

# Three current official names are absent from the snapshot aliases. Inkerman is
# assigned to Crimea in KATOTTG but remains grouped under Sevastopol in GeoNames.
GEONAMES_ID_OVERRIDES = {
    "Чистякове": "691374",
    "Новоазовськ": "699675",
    "Кадіївка": "692975",
    "Інкерман": "712576",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def column_index(cell_reference: str) -> int:
    match = re.match(r"[A-Z]+", cell_reference)
    if not match:
        raise SystemExit(f"无法解析 Excel 单元格：{cell_reference}")
    index = 0
    for letter in match.group(0):
        index = index * 26 + ord(letter) - ord("A") + 1
    return index - 1


def load_xlsx_rows(path: Path) -> list[list[str]]:
    if sha256(path) != OFFICIAL_XLSX_SHA256:
        raise SystemExit(f"乌克兰官方 KATOTTG 哈希不匹配：{path}")
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with ZipFile(path) as archive:
        strings_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared_strings = [
            "".join(text.text or "" for text in item.findall(".//x:t", namespace))
            for item in strings_root.findall("x:si", namespace)
        ]
        sheet_root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))

    rows: list[list[str]] = []
    for row in sheet_root.findall(".//x:sheetData/x:row", namespace):
        values = [""] * 7
        for cell in row.findall("x:c", namespace):
            index = column_index(cell.attrib["r"])
            if index >= len(values):
                continue
            value = cell.find("x:v", namespace)
            if value is None or value.text is None:
                continue
            values[index] = (
                shared_strings[int(value.text)]
                if cell.attrib.get("t") == "s"
                else value.text
            )
        rows.append(values)

    expected_header = [
        "Перший рівень",
        "Другий рівень",
        "Третій рівень",
        "Четвертий рівень",
        "Додатковий рівень",
        "Категорія об’єкта",
        "Назва об’єкта",
    ]
    try:
        header_index = rows.index(expected_header)
    except ValueError as cause:
        raise SystemExit("KATOTTG 表头已变化") from cause
    return [row for row in rows[header_index + 1 :] if any(row)]


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().casefold())
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9а-яіїєґ]+", "", plain)


def load_geonames(path: Path) -> tuple[list[dict[str, str]], dict[str, dict[str, str]]]:
    if sha256(path) != GEONAMES_SHA256:
        raise SystemExit(f"GeoNames 乌克兰来源哈希不匹配：{path}")
    places = []
    by_id = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[6] != "P":
            continue
        place = {
            "geonames_id": fields[0],
            "name": fields[1],
            "ascii_name": fields[2],
            "alternate_names": fields[3],
            "latitude": fields[4],
            "longitude": fields[5],
            "feature_code": fields[7],
            "admin1": fields[10],
            "admin2": fields[11],
            "admin3": fields[12],
            "population": fields[14] or "0",
        }
        places.append(place)
        by_id[place["geonames_id"]] = place
    return places, by_id


def names_for(place: dict[str, str]) -> set[str]:
    return {
        normalize(value)
        for value in [
            place["name"],
            place["ascii_name"],
            *place["alternate_names"].split(","),
        ]
        if value
    }


def build_rows(
    official_rows: list[list[str]],
    places: list[dict[str, str]],
    places_by_id: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    categories = Counter(row[5].strip() for row in official_rows)
    if categories["M"] != 461 or categories["K"] != 2:
        raise SystemExit("乌克兰法定城市数量应为 461 个 M 类城市和 2 个特殊地位城市")
    cities = [row for row in official_rows if row[5].strip() in {"M", "K"}]
    if len(cities) != 463:
        raise SystemExit("乌克兰法定城市总数应为 463")

    roots = {row[0].strip() for row in cities}
    if roots != set(ROOTS):
        raise SystemExit(f"乌克兰城市的一级地区已变化：{sorted(roots ^ set(ROOTS))}")

    index: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for place in places:
        for name in names_for(place):
            index[name][place["geonames_id"]] = place

    result = []
    for city in cities:
        root_code = city[0].strip()
        category = city[5].strip()
        official_name = city[6].strip()
        administrative_code = next(value.strip() for value in reversed(city[:5]) if value)
        expected_admin1 = ROOTS[root_code][1]
        candidates = [
            place
            for place in index.get(normalize(official_name), {}).values()
            if place["admin1"] == expected_admin1
        ]
        override = GEONAMES_ID_OVERRIDES.get(official_name)
        if override:
            place = places_by_id.get(override)
        elif candidates:
            place = max(
                candidates,
                key=lambda item: (
                    item["admin3"] == administrative_code[2:9],
                    item["admin2"] == administrative_code[2:6],
                    normalize(item["name"]) == normalize(official_name),
                    FEATURE_RANK.get(item["feature_code"], 0),
                    int(item["population"]),
                ),
            )
        else:
            place = None
        if place is None:
            raise SystemExit(f"无法为 {official_name} 匹配 GeoNames 城市点")

        result.append({
            "administrative_code": administrative_code,
            "name": place["name"],
            "official_name": official_name,
            "admin_area": ROOTS[root_code][0],
            "city_level": (
                "capital"
                if administrative_code == "UA80000000000093317"
                else "special_city"
                if category == "K"
                else "official_city"
            ),
            "geonames_id": place["geonames_id"],
            "feature_code": place["feature_code"],
            "population": place["population"],
            "longitude": f"{float(place['longitude']):.6f}",
            "latitude": f"{float(place['latitude']):.6f}",
        })

    expected_features = Counter({
        "PPLA2": 159,
        "PPL": 147,
        "PPLA3": 130,
        "PPLA": 24,
        "PPLQ": 2,
        "PPLC": 1,
    })
    if Counter(row["feature_code"] for row in result) != expected_features:
        raise SystemExit("乌克兰城市来源层级数量已变化")
    for field in ("administrative_code", "geonames_id"):
        values = [row[field] for row in result]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in result:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (22.0 <= longitude <= 40.3 and 44.2 <= latitude <= 52.5):
            raise SystemExit(f"{row['official_name']} 坐标超出乌克兰范围")
    return sorted(result, key=lambda row: (row["admin_area"], row["official_name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-ukraine-official-cities.py "
            "<kodifikator-07-07.xlsx> <UA.txt> [output.csv]"
        )
    official_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    places, places_by_id = load_geonames(geonames_path)
    rows = build_rows(load_xlsx_rows(official_path), places, places_by_id)
    write_csv(rows, output_path)
    print("已生成 463 个乌克兰法定城市中心点")


if __name__ == "__main__":
    main()
