#!/usr/bin/env python3
"""从 EKATTE 派生清单与固定 GeoNames 快照生成保加利亚全部法定城市。"""

from __future__ import annotations

import csv
import hashlib
import math
import sys
from collections import Counter
from pathlib import Path


EKATTE_SOURCE_SHA256 = "6918087B9DA34DDCEFCFED4E98FC0EA86C1BA4B398F92847B63ACB31224EC40C"
GEONAMES_SOURCE_SHA256 = "6BCF14265A04CB0A4CEAF6BA65E2D112966A52DF826E10ADAA125AA515661366"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "bg-official-towns-2026-09-06.csv"
)

PROVINCES_ZH = {
    "Благоевград": "布拉戈耶夫格勒州",
    "Бургас": "布尔加斯州",
    "Варна": "瓦尔纳州",
    "Велико Търново": "大特尔诺沃州",
    "Видин": "维丁州",
    "Враца": "弗拉察州",
    "Габрово": "加布罗沃州",
    "Добрич": "多布里奇州",
    "Кърджали": "克尔贾利州",
    "Кюстендил": "丘斯滕迪尔州",
    "Ловеч": "洛维奇州",
    "Монтана": "蒙塔纳州",
    "Пазарджик": "帕扎尔吉克州",
    "Перник": "佩尔尼克州",
    "Плевен": "普列文州",
    "Пловдив": "普罗夫迪夫州",
    "Разград": "拉兹格勒州",
    "Русе": "鲁塞州",
    "Силистра": "锡利斯特拉州",
    "Сливен": "斯利文州",
    "Смолян": "斯莫梁州",
    "София (столица)": "索非亚市",
    "София": "索非亚州",
    "Стара Загора": "旧扎戈拉州",
    "Търговище": "特尔戈维什特州",
    "Хасково": "哈斯科沃州",
    "Шумен": "舒门州",
    "Ямбол": "扬博尔州",
}

# GeoNames 的这四条记录没有保存与 EKATTE 完全一致的保加利亚语别名。
NAME_FALLBACK_IDS = {
    "Вълчи дол": "725679",
    "Свети Влас": "725816",
    "Върбица": "725649",
    "Шивачево": "727261",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_official_towns(path: Path) -> list[dict[str, str]]:
    if sha256(path) != EKATTE_SOURCE_SHA256:
        raise SystemExit(f"EKATTE 派生来源哈希不匹配：{path}")
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    town_rows = [
        row
        for row in rows
        if row["village"] == "0"
        and not row["name"].startswith(("ман. ", "гара "))
    ]
    excluded = [
        row["name"]
        for row in rows
        if row["village"] == "0"
        and row["name"].startswith(("ман. ", "гара "))
    ]
    if sorted(excluded) != sorted(
        ["ман. Клисурски манастир", "ман. Рилски манастир", "гара Бов", "гара Лакатник"]
    ):
        raise SystemExit(f"非城市记录已变化：{excluded}")
    if len(town_rows) != 257:
        raise SystemExit(f"保加利亚法定城市数量应为 257，实际为 {len(town_rows)}")
    if set(row["province"] for row in town_rows) != set(PROVINCES_ZH):
        raise SystemExit("保加利亚城市的州级分组已变化")
    return town_rows


def load_geonames(path: Path) -> list[dict[str, str]]:
    if sha256(path) != GEONAMES_SOURCE_SHA256:
        raise SystemExit(f"GeoNames 保加利亚来源哈希不匹配：{path}")
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
                "population": fields[14] or "0",
            }
        )
    return places


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dy = (lat1 - lat2) * 111.0
    dx = (lon1 - lon2) * 111.0 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def names_for(place: dict[str, str]) -> set[str]:
    return {
        value.casefold()
        for value in [
            place["name"],
            place["ascii_name"],
            *place["alternate_names"].split(","),
        ]
        if value
    }


def match_place(town: dict[str, str], places: list[dict[str, str]]) -> dict[str, str]:
    longitude, latitude = map(float, town["geo"].split(","))
    nearby = sorted(
        places,
        key=lambda place: distance_km(
            latitude,
            longitude,
            float(place["latitude"]),
            float(place["longitude"]),
        ),
    )[:10]
    matches = [place for place in nearby if town["name"].casefold() in names_for(place)]
    if matches:
        place = min(
            matches,
            key=lambda item: distance_km(
                latitude,
                longitude,
                float(item["latitude"]),
                float(item["longitude"]),
            ),
        )
    else:
        expected_id = NAME_FALLBACK_IDS.get(town["name"])
        place = next(
            (item for item in nearby if item["geonames_id"] == expected_id),
            None,
        )
        if place is None:
            raise SystemExit(f"无法为 {town['name']} 匹配唯一 GeoNames 城市点")

    distance = distance_km(
        latitude,
        longitude,
        float(place["latitude"]),
        float(place["longitude"]),
    )
    if distance > 4:
        raise SystemExit(f"{town['name']} 与 GeoNames 匹配点相距 {distance:.2f} 千米")
    return place


def build_rows(
    towns: list[dict[str, str]], places: list[dict[str, str]]
) -> list[dict[str, str]]:
    rows = []
    for town in towns:
        place = match_place(town, places)
        rows.append(
            {
                "administrative_code": town["ekatte"],
                "name": place["name"],
                "official_name": town["name"],
                "admin_area": PROVINCES_ZH[town["province"]],
                "city_level": "capital" if town["ekatte"] == "68134" else "official_town",
                "geonames_id": place["geonames_id"],
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    expected_features = Counter(
        {"PPL": 171, "PPLA2": 55, "PPLA": 26, "PPLX": 2, "PPLA3": 2, "PPLC": 1}
    )
    feature_counts = Counter(row["feature_code"] for row in rows)
    if feature_counts != expected_features:
        raise SystemExit(f"城市来源层级数量已变化：{dict(feature_counts)}")
    for field in ("administrative_code", "geonames_id"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (22.3 <= longitude <= 28.7 and 41.2 <= latitude <= 44.3):
            raise SystemExit(f"{row['official_name']} 坐标超出保加利亚范围")
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
            "用法：py -3.12 scripts/import-bulgaria-official-towns.py "
            "<settlements_loc.csv> <BG.txt> [output.csv]"
        )
    ekatte_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    rows = build_rows(load_official_towns(ekatte_path), load_geonames(geonames_path))
    write_csv(rows, output_path)
    print("已生成 257 个保加利亚法定城市中心点")


if __name__ == "__main__":
    main()
