#!/usr/bin/env python3
"""从官方 CUATM 与固定 GeoNames 快照生成摩尔多瓦全部法定城市。"""

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


OFFICIAL_XLSX_SHA256 = "21FF5525A7F22F04F0D3F1517EBC1F02401613665FDFE385258AA4C35C92D705"
GEONAMES_SHA256 = "3682C00E775ED596A323FD69502EF97071DD009BEB6431418565B5DF39B8204F"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "md-official-cities-2026-09-06.csv"
)

ROOT_NAMES_ZH = {
    "Chișinău": "基希讷乌市",
    "Bălți": "伯尔兹市",
    "Bender": "本德尔市",
    "Anenii Noi": "新阿内尼区",
    "Basarabeasca": "巴萨拉贝亚斯卡区",
    "Briceni": "布里切尼区",
    "Cahul": "卡胡尔区",
    "Cantemir": "坎特米尔区",
    "Călărași": "克勒拉希区",
    "Căușeni": "克乌谢尼区",
    "Cimișlia": "奇米什利亚区",
    "Criuleni": "克留莱尼区",
    "Dondușeni": "栋杜谢尼区",
    "Drochia": "德罗基亚区",
    "Edineț": "埃迪内茨区",
    "Fălești": "弗莱什蒂区",
    "Florești": "弗洛雷什蒂区",
    "Glodeni": "格洛代尼区",
    "Hîncești": "亨切什蒂区",
    "Ialoveni": "亚洛韦尼区",
    "Leova": "莱奥瓦区",
    "Nisporeni": "尼斯波雷尼区",
    "Ocnița": "奥克尼察区",
    "Orhei": "奥尔海伊区",
    "Rezina": "雷济纳区",
    "Rîșcani": "雷什卡内区",
    "Sîngerei": "森杰雷区",
    "Soroca": "索罗卡区",
    "Strășeni": "斯特勒谢尼区",
    "Șoldănești": "绍尔德内什蒂区",
    "Ștefan Vodă": "斯特凡沃达区",
    "Taraclia": "塔拉克利亚区",
    "Telenești": "泰莱内什蒂区",
    "Ungheni": "温盖尼区",
    "Unitatea Teritorială Autonomă Găgăuzia": "加告兹自治区",
    "Unitățile administrativ-teritoriale din stînga Nistrului": "德涅斯特河左岸地区",
}

FEATURE_RANK = {"PPLC": 5, "PPLA": 4, "PPLA2": 3, "PPL": 2, "PPLX": 1}
GEONAMES_ID_OVERRIDES = {"Cornești": "618020"}


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


def load_xlsx_rows(path: Path) -> list[dict[str, str]]:
    if sha256(path) != OFFICIAL_XLSX_SHA256:
        raise SystemExit(f"摩尔多瓦官方 CUATM 哈希不匹配：{path}")
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
    header, *data = rows
    if header != [
        "CodUnic", "ParentCodUnic", "CodStatistic", "ParentCodStatistic",
        "Statut", "DenumireRO", "DenumireRU",
    ]:
        raise SystemExit(f"CUATM 表头已变化：{header}")
    return [dict(zip(header, row, strict=True)) for row in data if row[0]]


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9а-я]+", "", plain.casefold())


def load_geonames(path: Path) -> list[dict[str, str]]:
    if sha256(path) != GEONAMES_SHA256:
        raise SystemExit(f"GeoNames 摩尔多瓦来源哈希不匹配：{path}")
    places = []
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[6] != "P":
            continue
        places.append({
            "geonames_id": fields[0], "name": fields[1], "ascii_name": fields[2],
            "alternate_names": fields[3], "latitude": fields[4], "longitude": fields[5],
            "feature_code": fields[7], "population": fields[14] or "0",
        })
    return places


def names_for(place: dict[str, str]) -> set[str]:
    return {
        normalize(value)
        for value in [place["name"], place["ascii_name"], *place["alternate_names"].split(",")]
        if value
    }


def root_for(row: dict[str, str], by_code: dict[str, dict[str, str]]) -> str:
    current = row
    while current["ParentCodUnic"] and current["ParentCodUnic"] in by_code:
        current = by_code[current["ParentCodUnic"]]
    return current["DenumireRO"]


def build_rows(
    official_rows: list[dict[str, str]], places: list[dict[str, str]]
) -> list[dict[str, str]]:
    by_code = {row["CodUnic"]: row for row in official_rows}
    cities = [row for row in official_rows if row["Statut"] in {"3", "5"}]
    if len(cities) != 67 or Counter(row["Statut"] for row in cities) != Counter({"3": 54, "5": 13}):
        raise SystemExit("摩尔多瓦法定城市数量应为 13 个 municipality 和 54 个 city")
    roots = {root_for(city, by_code) for city in cities}
    if roots != set(ROOT_NAMES_ZH):
        raise SystemExit(f"摩尔多瓦城市的上级地区已变化：{sorted(roots ^ set(ROOT_NAMES_ZH))}")

    index: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for place in places:
        for name in names_for(place):
            index[name][place["geonames_id"]] = place

    rows = []
    for city in cities:
        candidates = {
            **index.get(normalize(city["DenumireRO"]), {}),
            **index.get(normalize(city["DenumireRU"]), {}),
        }
        override = GEONAMES_ID_OVERRIDES.get(city["DenumireRO"])
        if override:
            place = candidates.get(override)
        elif candidates:
            place = max(candidates.values(), key=lambda item: (
                normalize(item["name"]) == normalize(city["DenumireRO"]),
                FEATURE_RANK.get(item["feature_code"], 0), int(item["population"]),
            ))
        else:
            place = None
        if place is None:
            raise SystemExit(f"无法为 {city['DenumireRO']} 匹配 GeoNames 城市点")
        rows.append({
            "administrative_code": city["CodUnic"],
            "name": place["name"],
            "official_name": city["DenumireRO"],
            "admin_area": ROOT_NAMES_ZH[root_for(city, by_code)],
            "city_level": "capital" if city["CodUnic"] == "0100" else (
                "municipality" if city["Statut"] == "5" else "official_city"
            ),
            "geonames_id": place["geonames_id"], "feature_code": place["feature_code"],
            "population": place["population"],
            "longitude": f"{float(place['longitude']):.6f}",
            "latitude": f"{float(place['latitude']):.6f}",
        })

    if Counter(row["feature_code"] for row in rows) != Counter({"PPLA": 35, "PPL": 31, "PPLC": 1}):
        raise SystemExit("摩尔多瓦城市来源层级数量已变化")
    for field in ("administrative_code", "official_name", "geonames_id"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (26.5 <= longitude <= 30.2 and 45.3 <= latitude <= 48.6):
            raise SystemExit(f"{row['official_name']} 坐标超出摩尔多瓦范围")
    return sorted(rows, key=lambda row: (row["admin_area"], row["official_name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-moldova-official-cities.py "
            "<CUATM_25.xlsx> <MD.txt> [output.csv]"
        )
    official_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    rows = build_rows(load_xlsx_rows(official_path), load_geonames(geonames_path))
    write_csv(rows, output_path)
    print("已生成 67 个摩尔多瓦法定城市中心点")


if __name__ == "__main__":
    main()
