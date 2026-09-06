#!/usr/bin/env python3
"""从塞尔维亚官方城市型聚居地名录生成地图城市中心点。"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


OFFICIAL_XLSX_SHA256 = "94AFB9355CD4FBBDAD768E52579C189873A751FDA524CC7C01B9DAEC598E3AA8"
GEONAMES_SHA256 = "92645DB1EB5FCFEC7886834A1970530488399B619CFF7E41DE0B79879CA90342"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "rs-official-urban-settlements-2026-09-06.csv"
)

DISTRICT_NAMES_ZH = {
    "0": "贝尔格莱德市",
    "1": "北巴奇卡行政区",
    "2": "中巴纳特行政区",
    "3": "北巴纳特行政区",
    "4": "南巴纳特行政区",
    "5": "西巴奇卡行政区",
    "6": "南巴奇卡行政区",
    "7": "斯雷姆行政区",
    "8": "马奇瓦行政区",
    "9": "科卢巴拉行政区",
    "10": "波杜纳夫列行政区",
    "11": "布拉尼切沃行政区",
    "12": "舒马迪亚行政区",
    "13": "波莫拉夫列行政区",
    "14": "博尔行政区",
    "15": "扎耶查尔行政区",
    "16": "兹拉蒂博尔行政区",
    "17": "莫拉维察行政区",
    "18": "拉什卡行政区",
    "19": "拉西纳行政区",
    "20": "尼沙瓦行政区",
    "21": "托普利察行政区",
    "22": "皮罗特行政区",
    "23": "亚布拉尼察行政区",
    "24": "普奇尼亚行政区",
}

# 官方城市名与 GeoNames 名称不一致，或来源只提供非 P 类中心点时固定绑定。
GEONAMES_ID_OVERRIDES = {
    "700649": "836583",  # Алексиначки Рудник -> Aleksinački Rudnici Uglja
    "722111": "788850",  # Куршумлијска Бања -> GeoNames SPA
    "731960": "787078",  # Петровац на Млави -> Petrovac
    "746665": "861049",  # Бело Поље（Surdulica）-> Bijelo Polje
}

CYRILLIC_TO_LATIN = {
    "А": "A",
    "Б": "B",
    "В": "V",
    "Г": "G",
    "Д": "D",
    "Ђ": "Đ",
    "Е": "E",
    "Ж": "Ž",
    "З": "Z",
    "И": "I",
    "Ј": "J",
    "К": "K",
    "Л": "L",
    "Љ": "Lj",
    "М": "M",
    "Н": "N",
    "Њ": "Nj",
    "О": "O",
    "П": "P",
    "Р": "R",
    "С": "S",
    "Т": "T",
    "Ћ": "Ć",
    "У": "U",
    "Ф": "F",
    "Х": "H",
    "Ц": "C",
    "Ч": "Č",
    "Џ": "Dž",
    "Ш": "Š",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def column_index(cell_reference: str) -> int:
    letters = re.match(r"[A-Z]+", cell_reference)
    if not letters:
        raise SystemExit(f"无法解析 Excel 单元格：{cell_reference}")
    index = 0
    for letter in letters.group(0):
        index = index * 26 + ord(letter) - ord("A") + 1
    return index - 1


def load_xlsx_rows(path: Path) -> list[list[str]]:
    if sha256(path) != OFFICIAL_XLSX_SHA256:
        raise SystemExit(f"塞尔维亚官方名录哈希不匹配：{path}")

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
        if int(row.attrib["r"]) < 4:
            continue
        values = [""] * 10
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
    return rows


def latinize(value: str) -> str:
    output: list[str] = []
    for character in value:
        upper = character.upper()
        replacement = CYRILLIC_TO_LATIN.get(upper)
        if replacement is None:
            output.append(character)
        elif character.islower():
            output.append(replacement.lower())
        else:
            output.append(replacement)
    return "".join(output)


def load_official_cities(path: Path) -> list[dict[str, str]]:
    cities: list[dict[str, str]] = []
    urban_count = 0
    kosovo_count = 0
    collapsed_component_count = 0

    for row in load_xlsx_rows(path):
        district_code, district_name, parent_code, parent_name = (
            row[0].strip(),
            row[1].strip(),
            row[2].strip(),
            row[3].strip(),
        )
        settlement_code, settlement_type, official_name = (
            row[7].strip(),
            row[8].strip(),
            row[9].strip(),
        )
        if not settlement_code or settlement_type != "G":
            continue
        urban_count += 1
        if district_code in {"25", "26", "27", "28", "29"}:
            kosovo_count += 1
            continue
        if official_name.startswith(("Београд (", "Ниш (")):
            collapsed_component_count += 1
            continue
        official_name = re.sub(r" \((?:варош|варошица)\)$", "", official_name)
        cities.append(
            {
                "administrative_code": settlement_code,
                "district_code": str(int(district_code)),
                "district_name": district_name,
                "parent_name": parent_name,
                "official_name": official_name,
            }
        )

    # 官方表将两座连续城市按市辖区重复登记；使用上级城市代码合并成单一地图点。
    cities.extend(
        [
            {
                "administrative_code": "79014",
                "district_code": "0",
                "district_name": "Град Београд",
                "parent_name": "Београд",
                "official_name": "Београд",
            },
            {
                "administrative_code": "79022",
                "district_code": "20",
                "district_name": "Нишавски управни округ",
                "parent_name": "Ниш",
                "official_name": "Ниш",
            },
        ]
    )

    if urban_count != 205 or kosovo_count != 26 or collapsed_component_count != 14:
        raise SystemExit(
            "官方城市型聚居地结构已变化："
            f"总数 {urban_count}，科索沃地区 {kosovo_count}，合并组成部分 {collapsed_component_count}"
        )
    if len(cities) != 167:
        raise SystemExit(f"官方城市点数量应为 167，实际为 {len(cities)}")
    return cities


def load_geonames(path: Path) -> tuple[dict[str, dict[str, str]], dict[str, list[dict[str, str]]]]:
    if sha256(path) != GEONAMES_SHA256:
        raise SystemExit(f"GeoNames 塞尔维亚来源哈希不匹配：{path}")

    by_id: dict[str, dict[str, str]] = {}
    by_name: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        place = {
            "geonames_id": fields[0],
            "name": fields[1],
            "ascii_name": fields[2],
            "feature_class": fields[6],
            "feature_code": fields[7],
            "admin1": fields[10],
            "admin2": fields[11],
            "population": fields[14] or "0",
            "longitude": fields[5],
            "latitude": fields[4],
        }
        by_id[place["geonames_id"]] = place
        names = {fields[1], fields[2], *filter(None, fields[3].split(","))}
        for name in names:
            by_name[name.casefold()][place["geonames_id"]] = place
    return by_id, {key: list(value.values()) for key, value in by_name.items()}


def choose_geonames_place(
    city: dict[str, str],
    by_id: dict[str, dict[str, str]],
    by_name: dict[str, list[dict[str, str]]],
) -> dict[str, str]:
    override_id = GEONAMES_ID_OVERRIDES.get(city["administrative_code"])
    if override_id:
        return by_id[override_id]

    candidates: dict[str, dict[str, str]] = {}
    for name in {city["official_name"], latinize(city["official_name"])}:
        for place in by_name.get(name.casefold(), []):
            if place["admin2"] == city["district_code"]:
                candidates[place["geonames_id"]] = place
    if not candidates:
        raise SystemExit(f"{city['official_name']} 缺少 GeoNames 中心点")

    latin_name = latinize(city["official_name"]).casefold()
    feature_rank = {"PPLC": 0, "PPLA": 1, "PPLA2": 2, "PPLA3": 3, "PPLA4": 4, "PPL": 5}
    ordered = sorted(
        candidates.values(),
        key=lambda place: (
            place["name"].casefold() != latin_name,
            feature_rank.get(place["feature_code"], 9),
            -int(place["population"]),
            int(place["geonames_id"]),
        ),
    )
    return ordered[0]


def city_level(feature_code: str) -> str:
    if feature_code == "PPLC":
        return "capital"
    if feature_code in {"PPLA", "PPLA2"}:
        return "district_capital"
    if feature_code in {"PPLA3", "PPLA4"}:
        return "municipal_center"
    return "urban_settlement"


def build_rows(official_path: Path, geonames_path: Path) -> list[dict[str, str]]:
    official_cities = load_official_cities(official_path)
    by_id, by_name = load_geonames(geonames_path)
    rows: list[dict[str, str]] = []

    for city in official_cities:
        place = choose_geonames_place(city, by_id, by_name)
        rows.append(
            {
                "administrative_code": city["administrative_code"],
                "name": place["name"],
                "official_name": city["official_name"],
                "admin_area": DISTRICT_NAMES_ZH[city["district_code"]],
                "city_level": city_level(place["feature_code"]),
                "geonames_id": place["geonames_id"],
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    if len({row["administrative_code"] for row in rows}) != 167:
        raise SystemExit("生成结果存在重复官方城市代码")
    if len({row["geonames_id"] for row in rows}) != 167:
        raise SystemExit("生成结果存在重复 GeoNames ID")
    if len({row["official_name"] for row in rows}) != 167:
        raise SystemExit("生成结果存在重复官方城市名")
    if set(row["admin_area"] for row in rows) != set(DISTRICT_NAMES_ZH.values()):
        raise SystemExit("生成结果未覆盖塞尔维亚全部 25 个行政区")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (18.8 <= longitude <= 23.1 and 41.8 <= latitude <= 46.3):
            raise SystemExit(f"{row['official_name']} 坐标超出塞尔维亚范围")

    level_counts = Counter(row["city_level"] for row in rows)
    if level_counts != Counter(
        {"capital": 1, "district_capital": 24, "municipal_center": 98, "urban_settlement": 44}
    ):
        raise SystemExit(f"城市层级数量已变化：{dict(level_counts)}")

    return sorted(
        rows,
        key=lambda row: (row["admin_area"], row["city_level"], row["official_name"]),
    )


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-serbia-official-urban-settlements.py "
            "<naselja2025.xlsx> <RS.txt> [output.csv]"
        )
    official_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    rows = build_rows(official_path, geonames_path)
    write_csv(rows, output_path)
    print("已生成 167 个塞尔维亚官方城市型聚居地中心点")


if __name__ == "__main__":
    main()
