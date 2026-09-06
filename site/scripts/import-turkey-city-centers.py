#!/usr/bin/env python3
"""Build Turkey's city-level catalog from a fixed GeoNames snapshot.

Usage:
  py -3.12 scripts/import-turkey-city-centers.py <TR.txt> [output.csv]
"""

from __future__ import annotations

import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path


EXPECTED_GEONAMES_HASH = (
    "3647C776E8E32F7076361C34445CBC63280F9A83B7E0BC886176808ECEB8DBB3"
)
EXPECTED_FEATURE_COUNTS = {
    "PPL": 111,
    "PPLA": 80,
    "PPLA2": 779,
    "PPLC": 1,
}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "tr-city-centers-2026-09-06.csv"
)

ADMIN_AREA_NAMES = {
    "02": "阿德亚曼省",
    "03": "阿菲永卡拉希萨尔省",
    "04": "阿勒省",
    "05": "阿马西亚省",
    "07": "安塔利亚省",
    "08": "阿尔特温省",
    "09": "艾登省",
    "10": "巴勒克埃西尔省",
    "11": "比莱吉克省",
    "12": "宾格尔省",
    "13": "比特利斯省",
    "14": "博卢省",
    "15": "布尔杜尔省",
    "16": "布尔萨省",
    "17": "恰纳卡莱省",
    "19": "乔鲁姆省",
    "20": "代尼兹利省",
    "21": "迪亚巴克尔省",
    "22": "埃迪尔内省",
    "23": "埃拉泽省",
    "24": "埃尔津詹省",
    "25": "埃尔祖鲁姆省",
    "26": "埃斯基谢希尔省",
    "28": "吉雷松省",
    "31": "哈塔伊省",
    "32": "梅尔辛省",
    "33": "伊斯帕尔塔省",
    "34": "伊斯坦布尔省",
    "35": "伊兹密尔省",
    "37": "卡斯塔莫努省",
    "38": "开塞利省",
    "39": "克尔克拉雷利省",
    "40": "克尔谢希尔省",
    "41": "科贾埃利省",
    "43": "屈塔希亚省",
    "44": "马拉蒂亚省",
    "45": "马尼萨省",
    "46": "卡赫拉曼马拉什省",
    "48": "穆拉省",
    "49": "穆什省",
    "50": "内夫谢希尔省",
    "52": "奥尔杜省",
    "53": "里泽省",
    "54": "萨卡里亚省",
    "55": "萨姆松省",
    "57": "锡诺普省",
    "58": "锡瓦斯省",
    "59": "泰基尔达省",
    "60": "托卡特省",
    "61": "特拉布宗省",
    "62": "通杰利省",
    "63": "尚勒乌尔法省",
    "64": "乌沙克省",
    "65": "凡省",
    "66": "约兹加特省",
    "68": "安卡拉省",
    "69": "居米什哈内省",
    "70": "哈卡里省",
    "71": "科尼亚省",
    "72": "马尔丁省",
    "73": "尼代省",
    "74": "锡尔特省",
    "75": "阿克萨赖省",
    "76": "巴特曼省",
    "77": "巴伊布尔特省",
    "78": "卡拉曼省",
    "79": "克勒克卡莱省",
    "80": "舍尔纳克省",
    "81": "阿达纳省",
    "82": "昌克勒省",
    "83": "加济安泰普省",
    "84": "卡尔斯省",
    "85": "宗古尔达克省",
    "86": "阿尔达汉省",
    "87": "巴尔滕省",
    "88": "厄德尔省",
    "89": "卡拉比克省",
    "90": "基利斯省",
    "91": "奥斯曼尼耶省",
    "92": "亚洛瓦省",
    "93": "迪兹杰省",
}
ADMINISTRATIVE_FEATURES = {"PPLC", "PPLA", "PPLA2"}
ALLOWED_FEATURES = ADMINISTRATIVE_FEATURES | {"PPL"}
CITY_LEVELS = {
    "PPLC": "country_capital",
    "PPLA": "province_capital",
    "PPLA2": "district_center",
    "PPL": "populated_place_5000_plus",
}

# Internal metropolitan districts, urban neighborhoods, and duplicate points.
# Their parent city remains on the map; physically separate district seats and
# ordinary towns remain included even when they belong to a metropolitan province.
EXCLUDED_GEONAMES_IDS = {
    # Adıyaman, Antalya, Aydın, Hatay, Karabük and other city-core neighborhoods.
    "13591680", "298091", "8068982", "8069036", "8068981", "8068986",
    "10182514", "438055", "438056", "438119", "750488",
    # Istanbul's contiguous urban districts and neighborhoods.
    "747323", "742394", "751324", "7627067", "738377", "738329",
    "747340", "7628420", "7628416", "741763", "6947640", "6947637",
    "7628419", "747158", "739549", "737071", "751868", "741529",
    "746234", "738064", "737081", "8623183", "738327", "750519",
    "6947639", "6947641", "740616", "749387", "10400338",
    # Izmir's contiguous urban districts.
    "7701384", "306641", "320257", "308988", "321743", "320857",
    "320528", "314826",
    # Kocaeli, Malatya, Muğla, Trabzon and Şanlıurfa urban neighborhoods.
    "742588", "742292", "737119", "745383", "7458188", "312659",
    "316667", "316214", "737478", "7539160",
    # Ankara and Adana urban districts and neighborhoods.
    "6955677", "307290", "311381", "307677", "301719", "305469",
    "301962", "7642396", "300997", "323716", "301770", "315155",
    "304885", "740511",
    # Antalya, Bursa and Denizli central districts.
    "8074174", "10377367", "306570", "10346824", "743404", "746232",
    "8542938", "8521963", "11238838", "10345315",
    # Diyarbakır, Erzurum, Eskişehir and Gaziantep central districts.
    "10048770", "308569", "10048774", "10048815", "317801", "10331003",
    "10331001", "10332081", "10345207", "10345206", "7619145", "7619146",
    # Kayseri, Konya and other duplicated central metropolitan districts.
    "299900", "318580", "315972", "748208", "11282178", "6692058",
    "304582", "312001", "7457829", "304418", "319977", "10402306",
    "751922", "747459", "739788", "10376352", "309653", "10375669",
    # Duplicate city points: retain the administrative center in each pair.
    "740561", "744093",
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
        raise SystemExit(f"GeoNames 土耳其快照哈希变化：{actual_hash}")

    places = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P" or values[7] not in ALLOWED_FEATURES:
                continue
            if values[0] in EXCLUDED_GEONAMES_IDS:
                continue
            population = int(values[14] or 0)
            if population > 5000 or values[7] in ADMINISTRATIVE_FEATURES:
                places.append(values)
    return places


def build_rows(places: list[list[str]]) -> list[dict[str, str]]:
    rows = []
    for place in places:
        geonames_id = place[0]
        source_name = place[1]
        feature_code = place[7]
        admin_area = ADMIN_AREA_NAMES.get(place[10])
        if admin_area is None:
            raise SystemExit(
                f"{source_name}（{geonames_id}）的省代码未收录：{place[10]}"
            )

        latitude = float(place[4])
        longitude = float(place[5])
        if not (25.5 <= longitude <= 45.0 and 35.5 <= latitude <= 42.2):
            raise SystemExit(f"{source_name}（{geonames_id}）中心点超出土耳其范围")

        rows.append(
            {
                "administrative_code": geonames_id,
                "name": source_name,
                "admin_area": admin_area,
                "city_level": CITY_LEVELS[feature_code],
                "geonames_id": geonames_id,
                "feature_code": feature_code,
                "population": place[14] or "0",
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    feature_counts = Counter(row["feature_code"] for row in rows)
    if dict(sorted(feature_counts.items())) != EXPECTED_FEATURE_COUNTS:
        raise SystemExit(f"土耳其城市层级数量变化：{dict(feature_counts)}")
    if len(rows) != 971:
        raise SystemExit(f"土耳其城市数量变化：{len(rows)}")
    if set(ADMIN_AREA_NAMES.values()) != {row["admin_area"] for row in rows}:
        raise SystemExit("土耳其 81 个省覆盖发生变化")

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
            "用法：py -3.12 scripts/import-turkey-city-centers.py <TR.txt> [output.csv]"
        )
    source_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else DEFAULT_OUTPUT
    rows = build_rows(load_places(source_path))
    write_csv(rows, output_path)
    print("已生成 971 个土耳其城市级中心点")


if __name__ == "__main__":
    main()
