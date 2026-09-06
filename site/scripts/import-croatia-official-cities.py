#!/usr/bin/env python3
"""Build Croatia's 128-city official catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-croatia-official-cities.py <HR.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "8F96F768C771746C8E4770D39D1C827E7B22D0E155F15DF8B778B0BF6D130F1C"
)
EXPECTED_FEATURE_COUNTS = {"PPLA": 19, "PPLA2": 108, "PPLC": 1}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "hr-official-cities-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "01": "比耶洛瓦尔-比洛戈拉县",
    "02": "布罗德-波萨维纳县",
    "03": "杜布罗夫尼克-内雷特瓦县",
    "04": "伊斯特拉县",
    "05": "卡尔洛瓦茨县",
    "06": "科普里夫尼察-克里热夫齐县",
    "07": "克拉皮纳-扎戈列县",
    "08": "利卡-塞尼县",
    "09": "梅吉穆列县",
    "10": "奥西耶克-巴拉尼亚县",
    "11": "波热加-斯拉沃尼亚县",
    "12": "滨海和山区县",
    "13": "希贝尼克-克宁县",
    "14": "锡萨克-莫斯拉维纳县",
    "15": "斯普利特-达尔马提亚县",
    "16": "瓦拉日丁县",
    "17": "维罗维蒂察-波德拉维纳县",
    "18": "武科瓦尔-斯里耶姆县",
    "19": "扎达尔县",
    "20": "萨格勒布县",
    "21": "萨格勒布市",
}

# Ministry list: 127 grad units plus Zagreb. Exact GeoNames IDs prevent
# same-name settlements in other counties from being selected. Kaštela is a
# polycentric legal city and uses its administrative center at Kaštel Sućurac.
OFFICIAL_CITY_IDS = {
    "3186294", "3186406", "3186604", "3186781", "3186886", "3186952",
    "3186984", "3187047", "3187169", "3187230", "3187257", "3187265",
    "3187477", "3187489", "3187685", "3187694", "3187719", "3188244",
    "3188380", "3188383", "3188395", "3188498", "3188763", "3188830",
    "3189386", "3189492", "3189965", "3190261", "3190359", "3190523",
    "3190586", "3190589", "3190692", "3190813", "3190865", "3190941",
    "3191055", "3191316", "3191518", "3191648", "3192178", "3192224",
    "3192532", "3192545", "3192699", "3192724", "3192932", "3193150",
    "3193187", "3193420", "3193561", "3193706", "3193726", "3193754",
    "3193781", "3193788", "3193935", "3193962", "3194064", "3194075",
    "3194099", "3194114", "3194183", "3194245", "3194319", "3194355",
    "3194367", "3194379", "3194422", "3194449", "3194581", "3194626",
    "3195222", "3195674", "3195890", "3196120", "3196534", "3196657",
    "3196834", "3196855", "3196864", "3197208", "3197230", "3197369",
    "3197390", "3197594", "3197710", "3197728", "3197834", "3197986",
    "3198103", "3198210", "3198227", "3198799", "3199069", "3199076",
    "3199111", "3199128", "3199180", "3199515", "3199873", "3200600",
    "3200711", "3200961", "3201009", "3201030", "3201047", "3201162",
    "3201432", "3201621", "3202104", "3202184", "3202220", "3202507",
    "3202523", "3202820", "3202888", "3202932", "3202942", "3203090",
    "3203982", "3204121", "3204293", "3204317", "3204320", "3204612",
    "3216446", "3345300",
}

OFFICIAL_NAME_OVERRIDES = {
    "3189386": "Sveta Nedelja",
    "3198210": "Kaštela",
    "3203090": "Buje-Buie",
    "3194379": "Novigrad-Cittanova",
    "3192699": "Poreč-Parenzo",
    "3192224": "Pula-Pola",
    "3191518": "Rovinj-Rovigno",
    "3188498": "Umag-Umago",
    "3187477": "Vodnjan-Dignano",
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
        raise SystemExit(f"GeoNames 克罗地亚快照哈希变化：{actual_hash}")

    places = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) >= 19 and values[0] in OFFICIAL_CITY_IDS:
                places[values[0]] = values
    missing = sorted(OFFICIAL_CITY_IDS - set(places))
    if missing:
        raise SystemExit(f"GeoNames 快照缺少克罗地亚官方城市：{missing}")
    return list(places.values())


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin_area = ADMIN_AREA_NAMES.get(place[10])
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的县代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (13.4 <= longitude <= 19.5 and 42.3 <= latitude <= 46.7):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出克罗地亚范围")

        city_level = {
            "PPLC": "country_capital",
            "PPLA": "county_capital",
            "PPLA2": "official_city",
        }.get(feature_code)
        if city_level is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）来源层级异常：{feature_code}"
            )

        rows.append(
            {
                "administrative_code": geonames_id,
                "name": source_name,
                "official_name": OFFICIAL_NAME_OVERRIDES.get(geonames_id, source_name),
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
        raise SystemExit(f"克罗地亚来源层级数量变化：{dict(feature_counts)}")
    if len(rows) != 128:
        raise SystemExit(f"克罗地亚官方城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("克罗地亚 21 个县级地区覆盖发生变化")

    for field, values in (
        ("稳定 ID", [row["administrative_code"] for row in rows]),
        ("GeoNames ID", [row["geonames_id"] for row in rows]),
        ("官方名称", [row["official_name"] for row in rows]),
        ("中心坐标", [(row["longitude"], row["latitude"]) for row in rows]),
    ):
        duplicates = [value for value, count in Counter(values).items() if count > 1]
        if duplicates:
            raise SystemExit(f"生成结果存在重复{field}：{duplicates}")

    return sorted(
        rows,
        key=lambda row: (
            row["admin_area"], row["city_level"], row["official_name"], row["administrative_code"]
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
            "用法：py -3.12 scripts/import-croatia-official-cities.py <HR.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 128 个克罗地亚官方城市中心点")


if __name__ == "__main__":
    main()
