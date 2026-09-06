#!/usr/bin/env python3
"""从官方 SIRUTA 2025 与固定 GeoNames 快照生成罗马尼亚全部法定城市。"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


SIRUTA_SOURCE_SHA256 = "A223E6FD6C2B1B63DFD1339CB1E16C07A7E0A3C810AC4987112147CE9DDF806B"
GEONAMES_SOURCE_SHA256 = "799F1C2D360E0C4D562510DC9EB0FFEBCD4339E871ECC030FBC61A5D6F1730EA"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "ro-official-cities-2026-09-06.csv"
)

COUNTIES = {
    "1": ("01", "阿尔巴县"),
    "2": ("02", "阿拉德县"),
    "3": ("03", "阿尔杰什县"),
    "4": ("04", "巴克乌县"),
    "5": ("05", "比霍尔县"),
    "6": ("06", "比斯特里察-讷瑟乌德县"),
    "7": ("07", "博托沙尼县"),
    "8": ("09", "布拉索夫县"),
    "9": ("08", "布勒伊拉县"),
    "10": ("11", "布泽乌县"),
    "11": ("12", "卡拉什-塞韦林县"),
    "12": ("13", "克卢日县"),
    "13": ("14", "康斯坦察县"),
    "14": ("15", "科瓦斯纳县"),
    "15": ("16", "登博维察县"),
    "16": ("17", "多尔日县"),
    "17": ("18", "加拉茨县"),
    "18": ("19", "戈尔日县"),
    "19": ("20", "哈尔吉塔县"),
    "20": ("21", "胡内多阿拉县"),
    "21": ("22", "雅洛米察县"),
    "22": ("23", "雅西县"),
    "23": ("43", "伊尔福夫县"),
    "24": ("25", "马拉穆列什县"),
    "25": ("26", "梅赫丁茨县"),
    "26": ("27", "穆列什县"),
    "27": ("28", "尼亚姆茨县"),
    "28": ("29", "奥尔特县"),
    "29": ("30", "普拉霍瓦县"),
    "30": ("32", "萨图马雷县"),
    "31": ("31", "瑟拉日县"),
    "32": ("33", "锡比乌县"),
    "33": ("34", "苏恰瓦县"),
    "34": ("35", "泰莱奥尔曼县"),
    "35": ("36", "蒂米什县"),
    "36": ("37", "图尔恰县"),
    "37": ("38", "瓦斯卢伊县"),
    "38": ("39", "沃尔恰县"),
    "39": ("40", "弗朗恰县"),
    "40": ("10", "布加勒斯特市"),
    "51": ("41", "克勒拉希县"),
    "52": ("42", "久尔久县"),
}

FEATURE_RANK = {"PPLC": 6, "PPLA": 5, "PPLA2": 4, "PPLA3": 3, "PPL": 2, "PPLX": 1}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_letters = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", ascii_letters.casefold())


def legal_name(value: str) -> str:
    return re.sub(r"^(?:MUNICIPIUL|ORAŞ)\s+", "", value.strip())


def load_siruta_cities(path: Path) -> list[dict[str, str]]:
    if sha256(path) != SIRUTA_SOURCE_SHA256:
        raise SystemExit(f"SIRUTA 2025 来源哈希不匹配：{path}")
    with path.open(encoding="utf-8-sig", newline="") as source:
        all_rows = list(csv.DictReader(source))

    cities = [row for row in all_rows if row["NIV"] == "2" and row["MED"] == "1"]
    if len(cities) != 319:
        raise SystemExit(f"罗马尼亚法定城市数量应为 319，实际为 {len(cities)}")
    if Counter(row["TIP"] for row in cities) != Counter(
        {"2": 216, "4": 62, "1": 40, "9": 1}
    ):
        raise SystemExit("罗马尼亚 municipiu / oraș 数量已变化")
    if set(row["JUD"] for row in cities) != set(COUNTIES):
        raise SystemExit("罗马尼亚城市的县级分组已变化")

    primary_components: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in all_rows:
        if row["NIV"] == "3" and row["TIP"] in {"9", "17"}:
            primary_components[row["SIRSUP"]].append(row)
    for city in cities:
        if city["SIRUTA"] == "179132":
            city["center_name"] = "Bucuresti"
            continue
        components = primary_components.get(city["SIRUTA"], [])
        if len(components) != 1:
            raise SystemExit(
                f"{city['DENLOC']} 的主要城市聚居地数量异常：{len(components)}"
            )
        city["center_name"] = components[0]["DENLOC"]
    return cities


def load_geonames(path: Path) -> list[dict[str, str]]:
    if sha256(path) != GEONAMES_SOURCE_SHA256:
        raise SystemExit(f"GeoNames 罗马尼亚来源哈希不匹配：{path}")
    places = []
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[6] != "P":
            continue
        places.append(
            {
                "geonames_id": fields[0],
                "name": fields[1],
                "ascii_name": fields[2],
                "alternate_names": fields[3],
                "latitude": fields[4],
                "longitude": fields[5],
                "feature_code": fields[7],
                "admin1_code": fields[10],
                "population": fields[14] or "0",
            }
        )
    return places


def names_for(place: dict[str, str]) -> set[str]:
    return {
        normalize(value)
        for value in [place["name"], place["ascii_name"], *place["alternate_names"].split(",")]
        if value
    }


def place_index(places: list[dict[str, str]]) -> dict[tuple[str, str], list[dict[str, str]]]:
    result: dict[tuple[str, str], dict[str, dict[str, str]]] = defaultdict(dict)
    for place in places:
        for name in names_for(place):
            result[(name, place["admin1_code"])][place["geonames_id"]] = place
    return {key: list(items.values()) for key, items in result.items()}


def match_place(
    city: dict[str, str], index: dict[tuple[str, str], list[dict[str, str]]]
) -> dict[str, str]:
    center_name = city["center_name"]
    admin1_code = COUNTIES[city["JUD"]][0]
    candidates = index.get((normalize(center_name), admin1_code), [])
    if not candidates:
        raise SystemExit(f"无法为 {center_name} 匹配 GeoNames 城市点")
    return max(
        candidates,
        key=lambda place: (
            normalize(place["name"]) == normalize(center_name),
            FEATURE_RANK.get(place["feature_code"], 0),
            int(place["population"]),
        ),
    )


def build_rows(
    cities: list[dict[str, str]], places: list[dict[str, str]]
) -> list[dict[str, str]]:
    index = place_index(places)
    rows = []
    for city in cities:
        place = match_place(city, index)
        official_name = legal_name(city["DENLOC"])
        rows.append(
            {
                "administrative_code": city["SIRUTA"],
                "name": place["name"],
                "official_name": official_name,
                "admin_area": COUNTIES[city["JUD"]][1],
                "city_level": "capital" if city["SIRUTA"] == "179132" else (
                    "municipiu" if city["TIP"] in {"1", "4"} else "oras"
                ),
                "geonames_id": place["geonames_id"],
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    expected_features = Counter({"PPLA2": 260, "PPLA": 39, "PPL": 17, "PPLX": 2, "PPLC": 1})
    feature_counts = Counter(row["feature_code"] for row in rows)
    if feature_counts != expected_features:
        raise SystemExit(f"城市来源层级数量已变化：{dict(feature_counts)}")
    for field in ("administrative_code", "geonames_id"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (20.1 <= longitude <= 30.0 and 43.5 <= latitude <= 48.3):
            raise SystemExit(f"{row['official_name']} 坐标超出罗马尼亚范围")
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
            "用法：py -3.12 scripts/import-romania-official-cities.py "
            "<siruta_s1_2025.csv> <RO.txt> [output.csv]"
        )
    siruta_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    rows = build_rows(load_siruta_cities(siruta_path), load_geonames(geonames_path))
    write_csv(rows, output_path)
    print("已生成 319 个罗马尼亚法定城市中心点")


if __name__ == "__main__":
    main()
