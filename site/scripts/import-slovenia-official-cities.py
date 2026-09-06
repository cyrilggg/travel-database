#!/usr/bin/env python3
"""从固定 GeoNames 快照生成斯洛文尼亚全部法定城市中心点。"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


SOURCE_SHA256 = "82A5E0C53656C359C8DE6C39070960121B10647AD024CBAC960C21F34F47D0F9"
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "sources"
    / "si-official-cities-2026-09-06.csv"
)

OFFICIAL_CITY_IDS = {
    "3204854": "Ajdovščina",
    "3203925": "Bled",
    "3203611": "Bovec",
    "3203412": "Brežice",
    "3202781": "Celje",
    "3202333": "Črnomelj",
    "3201730": "Domžale",
    "3200197": "Gornja Radgona",
    "3199297": "Hrastnik",
    "3199171": "Idrija",
    "3199131": "Ilirska Bistrica",
    "3199017": "Izola",
    "3198647": "Jesenice",
    "3198365": "Kamnik",
    "3197943": "Kočevje",
    "3197753": "Koper",
    "3197581": "Kostanjevica na Krki",
    "3197378": "Kranj",
    "3197147": "Krško",
    "3196760": "Laško",
    "3196681": "Lendava",
    "3196425": "Litija",
    "3196359": "Ljubljana",
    "3196307": "Ljutomer",
    "3195506": "Maribor",
    "3195214": "Metlika",
    "3194648": "Murska Sobota",
    "3194452": "Nova Gorica",
    "3194351": "Novo mesto",
    "3193965": "Ormož",
    "3193341": "Piran",
    "3192673": "Postojna",
    "3192241": "Ptuj",
    "3192144": "Radeče",
    "3192063": "Radovljica",
    "3191839": "Ravne na Koroškem",
    "3190950": "Sevnica",
    "3190945": "Sežana",
    "3190534": "Slovenska Bistrica",
    "3190536": "Slovenj Gradec",
    "3190530": "Slovenske Konjice",
    "3190717": "Škofja Loka",
    "3190311": "Šoštanj",
    "3189038": "Tolmin",
    "3188915": "Trbovlje",
    "3188688": "Tržič",
    "3189075": "Velenje",
    "3187663": "Višnja Gora",
    "3187214": "Vrhnika",
    "3186906": "Zagorje ob Savi",
    "3186844": "Žalec",
    "3202709": "Cerknica",
    "3201253": "Dravograd",
    "3199523": "Grosuplje",
    "3218907": "Logatec",
    "3195281": "Medvode",
    "3195250": "Mengeš",
    "3195202": "Mežica",
    "3192484": "Prevalje",
    "3191685": "Ribnica",
    "3191580": "Rogaška Slatina",
    "3191401": "Ruše",
    "3191063": "Šempeter pri Gorici",
    "3191029": "Šentjur",
    "3188886": "Trebnje",
    "3186607": "Železniki",
    "3186450": "Žiri",
    "3196682": "Lenart v Slovenskih goricah",
    "3339120": "Zreče",
}

REGIONS = {
    "上卡尼奥拉统计区": {
        "Bled", "Jesenice", "Kranj", "Radovljica", "Škofja Loka", "Tržič", "Železniki", "Žiri"
    },
    "戈里齐亚统计区": {
        "Ajdovščina", "Bovec", "Idrija", "Nova Gorica", "Šempeter pri Gorici", "Tolmin"
    },
    "滨海-喀斯特统计区": {"Izola", "Koper", "Piran", "Sežana"},
    "滨海-内卡尼奥拉统计区": {"Cerknica", "Ilirska Bistrica", "Postojna"},
    "中斯洛文尼亚统计区": {
        "Domžale", "Grosuplje", "Kamnik", "Ljubljana", "Logatec", "Medvode", "Mengeš",
        "Višnja Gora", "Vrhnika"
    },
    "东南斯洛文尼亚统计区": {
        "Črnomelj", "Kočevje", "Metlika", "Novo mesto", "Ribnica", "Trebnje"
    },
    "下萨瓦统计区": {"Brežice", "Kostanjevica na Krki", "Krško", "Radeče", "Sevnica"},
    "中萨瓦统计区": {"Hrastnik", "Litija", "Trbovlje", "Zagorje ob Savi"},
    "萨维尼亚统计区": {
        "Celje", "Laško", "Rogaška Slatina", "Slovenske Konjice", "Šentjur", "Šoštanj",
        "Velenje", "Žalec", "Zreče"
    },
    "科罗什卡统计区": {
        "Dravograd", "Mežica", "Prevalje", "Ravne na Koroškem", "Slovenj Gradec"
    },
    "波德拉夫统计区": {
        "Lenart v Slovenskih goricah", "Maribor", "Ormož", "Ptuj", "Ruše", "Slovenska Bistrica"
    },
    "波穆尔统计区": {"Gornja Radgona", "Lendava", "Ljutomer", "Murska Sobota"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_places(path: Path) -> dict[str, dict[str, str]]:
    if sha256(path) != SOURCE_SHA256:
        raise SystemExit(f"GeoNames 斯洛文尼亚来源哈希不匹配：{path}")
    places: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[0] not in OFFICIAL_CITY_IDS:
            continue
        places[fields[0]] = {
            "name": fields[1],
            "feature_code": fields[7],
            "population": fields[14] or "0",
            "longitude": fields[5],
            "latitude": fields[4],
        }
    if set(places) != set(OFFICIAL_CITY_IDS):
        missing = sorted(set(OFFICIAL_CITY_IDS) - set(places))
        raise SystemExit(f"GeoNames 缺少斯洛文尼亚官方城市：{missing}")
    return places


def region_for(official_name: str) -> str:
    matches = [region for region, cities in REGIONS.items() if official_name in cities]
    if len(matches) != 1:
        raise SystemExit(f"{official_name} 的统计区映射数量异常：{matches}")
    return matches[0]


def build_rows(places: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    if len(OFFICIAL_CITY_IDS) != 69:
        raise SystemExit(f"斯洛文尼亚法定城市数量应为 69，实际为 {len(OFFICIAL_CITY_IDS)}")
    if set().union(*REGIONS.values()) != set(OFFICIAL_CITY_IDS.values()):
        raise SystemExit("斯洛文尼亚法定城市与统计区映射不一致")

    rows = []
    for geonames_id, official_name in OFFICIAL_CITY_IDS.items():
        place = places[geonames_id]
        rows.append(
            {
                "administrative_code": geonames_id,
                "name": place["name"],
                "official_name": official_name,
                "admin_area": region_for(official_name),
                "city_level": "capital" if place["feature_code"] == "PPLC" else "official_city",
                "geonames_id": geonames_id,
                "feature_code": place["feature_code"],
                "population": place["population"],
                "longitude": f"{float(place['longitude']):.6f}",
                "latitude": f"{float(place['latitude']):.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if feature_counts != Counter({"PPLA": 67, "PPLC": 1, "PPL": 1}):
        raise SystemExit(f"城市来源层级数量已变化：{dict(feature_counts)}")
    for field in ("administrative_code", "geonames_id", "official_name"):
        values = [row[field] for row in rows]
        if len(values) != len(set(values)):
            raise SystemExit(f"生成结果存在重复字段：{field}")
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (13.3 <= longitude <= 16.7 and 45.4 <= latitude <= 46.9):
            raise SystemExit(f"{row['official_name']} 坐标超出斯洛文尼亚范围")

    return sorted(rows, key=lambda row: (row["admin_area"], row["official_name"]))


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-slovenia-official-cities.py <SI.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 69 个斯洛文尼亚法定城市中心点")


if __name__ == "__main__":
    main()
