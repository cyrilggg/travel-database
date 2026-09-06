#!/usr/bin/env python3
"""Build Pakistan's city-level municipal catalog from pinned source snapshots.

Usage:
  py -3.12 scripts/import-pakistan-municipal-cities.py \
    <table_2_national.xlsx> <PK.txt> [output.csv]

The workbook is Pakistan Bureau of Statistics census 2023 Table 2. PK.txt is
the extracted GeoNames Pakistan country dump. The importer intentionally keeps
Metropolitan Corporations, Municipal Corporations, District Municipal
Corporations and Municipal Committees; Town Committees and Cantonments are not
city-level entries in this catalog.
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError as error:
    raise SystemExit("缺少 openpyxl；请先运行 `py -m pip install openpyxl`") from error


EXPECTED_CENSUS_HASH = (
    "F36A8DC0E077CA6A5C3CF232325A35929588E8651B0F6046AAA3C5D7F6EF9F29"
)
EXPECTED_GEONAMES_HASH = (
    "D1D4D4C882C990F1D61C240B02BAFB2E92C5B45DDE64331CFD26E0D5BCA51573"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = SCRIPT_DIR.parent / "data" / "sources" / "pk-municipal-cities-2023.csv"

ADMIN1_NAMES = {
    "01": "Gilgit-Baltistan",
    "02": "Balochistan",
    "03": "Khyber Pakhtunkhwa",
    "04": "Punjab",
    "05": "Sindh",
    "06": "Azad Jammu and Kashmir",
    "07": "Gilgit-Baltistan",
    "08": "Islamabad Capital Territory",
}

# The census reflects current districts while GeoNames still assigns some
# places to their parent district or uses an older English name.
DISTRICT_ALIASES = {
    "CHAMAN": "Qila Abdullah",
    "DUKI": "Loralai",
    "LOWER CHITRAL": "Chitral",
    "SHAHEED BENAZIRABAD": "Nawabshah",
    "SURAB": "Kalat",
}

DISTRICT_KEY_OVERRIDES = {
    "ISLAMABAD": ("08", ""),
    # GeoNames has not yet added the 2020 Keamari District boundary. Its city
    # point is still filed under Karachi Central, and the included DMC is pinned.
    "KEAMARI": ("05", "11744831"),
}

# Explicit records avoid false fuzzy matches caused by spelling variants,
# recently changed boundaries and Karachi's district-municipal structure.
POINT_OVERRIDES = {
    ("AWARAN", "GUJAR MASHKAI"): "1179112",
    ("BAHAWALNAGAR", "DONGA BONGA"): "1179463",
    ("BAHAWALNAGAR", "HAROONABAD"): "1177073",
    ("HANGU", "TALL"): "1163651",
    ("ISLAMABAD", "ISLAMABAD"): "1176615",
    ("JHELUM", "DINA"): "1179800",
    ("KACHHI", "BHAG"): "1182872",
    ("KASUR", "KHADIAN"): "1173759",
    ("KECH", "BULAIDA"): "1181169",
    ("KHAIRPUR", "KINGRI (PIRJO GOTH)"): "1161991",
    ("KHUSHAB", "NOOR PUR"): "1168773",
    ("JHANG", "18-HAZARI"): "10345559",
    ("JAMSHORO", "BOLHARI"): "1182584",
    ("JAFFARABAD", "USTA MUHAMMAD"): "1162868",
    ("LAYYAH", "CHOWK AZAM"): "1426617",
    ("LAYYAH", "KAROR LAL ESAN"): "1174720",
    ("LODHRAN", "KAHROR PACCA"): "1175446",
    ("MUZAFFARGARH", "CHOWK SARWAR SHAHEED"): "1169798",
    ("NANKANA SAHIB", "NANKANA"): "1169372",
    ("NOWSHERA", "JEHANGIRA"): "1176452",
    ("OKARA", "HAVELI LAKHA WASAWEWALA"): "11540238",
    ("OKARA", "HUJRA SHAH MUQEEM"): "1176800",
    ("PANJGUR", "TASP"): "11221164",
    ("PANJGUR", "WASHBOOD"): "11225240",
    ("RAHIM YAR KHAN", "TRINDA SAWAI KHAN"): "11023533",
    ("RAJANPUR", "FAZALPUR"): "1179251",
    ("RAJANPUR", "KOT MITHAN"): "1170228",
    ("RAWALPINDI", "KALLAR SYEDAN"): "1175233",
    ("SARGODHA", "KOT MOMIN"): "1172964",
    ("SARGODHA", "SHAHPUR SADDAR"): "1165518",
    ("SHEIKHUPURA", "FEROZEWALA"): "1331564",
    ("SHEIKHUPURA", "MANAWALA JODH SINGH"): "1331657",
    ("SHEIKHUPURA", "KHANQAH DOGRAN"): "1174217",
    ("SHEIKHUPURA", "SAFDARABAD"): "10345571",
    ("SWAT", "BEHRAIN"): "1183846",
    ("KARACHI CENTRAL", "KARACHI CENTRAL"): "11744831",
    ("KARACHI EAST", "KARACHI EAST"): "11744832",
    ("KARACHI SOUTH", "KARACHI SOUTH"): "11744833",
    ("KORANGI", "KORANGI"): "11744835",
    ("MALIR", "MALIR"): "11744837",
    ("KEAMARI", "KEAMARI"): "1173638",
    ("KARACHI WEST", "KARACHI WEST"): "8335417",
}

MANUAL_POINT_OVERRIDES = {
    # GeoNames has no record for the modern Farooqabad/Chuhar Kana city. This
    # representative OSM city node is documented in data/README.md.
    ("SHEIKHUPURA", "FAROOQ ABAD"): {
        "id": "",
        "name": "Farooqabad",
        "latitude": "31.742100",
        "longitude": "73.831800",
    },
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
    value = unicodedata.normalize("NFKD", value).lower()
    value = value.replace("’", "").replace("'", "")
    for word in (
        "district municipal corporation",
        "metropolitan corporation",
        "municipal corporation",
        "municipal committee",
        "district",
        "city",
        "saddar",
        "mc",
    ):
        value = value.replace(word, "")
    return "".join(character for character in value if character.isalnum())


def similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalized_name(left), normalized_name(right)).ratio()


def administrative_code(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]+", "-", decomposed.upper()).strip("-")


def classify_body(base_name: str) -> tuple[str, str]:
    if base_name.startswith("DISTRICT MUNICIPAL CORPORATION "):
        return (
            "district_municipal_corporation",
            base_name.removeprefix("DISTRICT MUNICIPAL CORPORATION "),
        )
    if base_name.endswith(" METROPOLITAN CORPORATION"):
        return "metropolitan_corporation", base_name.removesuffix(" METROPOLITAN CORPORATION")
    if base_name.endswith(" MUNICIPAL CORPORATION"):
        return "municipal_corporation", base_name.removesuffix(" MUNICIPAL CORPORATION")
    if base_name.endswith(" MC"):
        return "municipal_committee", base_name.removesuffix(" MC")
    if base_name.endswith(" TC"):
        return "town_committee", base_name.removesuffix(" TC")
    if "CANTONMENT" in base_name:
        return "cantonment", re.sub(r"\s+CANTONMENT(?: BOARD)?$", "", base_name)
    raise SystemExit(f"无法识别城市机构类型：{base_name}")


def parse_census(path: Path) -> list[dict[str, str]]:
    sheet = load_workbook(path, read_only=True, data_only=True)["Poplulation"]
    raw_rows = []
    for values in sheet.iter_rows(min_row=4, values_only=True):
        name, district, population = values[:3]
        if not isinstance(population, (int, float)):
            continue
        raw_rows.append(
            {
                "source_name": str(name).strip(),
                "district": re.sub(r"\s+DISTRICT$", "", str(district).strip()),
            }
        )
    if len(raw_rows) != 657:
        raise SystemExit(f"官方普查表应有 657 个 urban locality 分段，实际为 {len(raw_rows)}")

    bodies = {}
    for row in raw_rows:
        base_name = re.sub(r"\s*\(Part of .*\)$", "", row["source_name"])
        body_type, name = classify_body(base_name)
        key = (row["district"], base_name)
        bodies[key] = {
            "district": row["district"],
            "base_name": base_name,
            "body_type": body_type,
            "name": name,
        }

    if len(bodies) != 622:
        raise SystemExit(f"按区合并分段后应有 622 个机构记录，实际为 {len(bodies)}")
    counts = Counter(row["body_type"] for row in bodies.values())
    expected = {
        "metropolitan_corporation": 8,
        "municipal_corporation": 21,
        "district_municipal_corporation": 7,
        "municipal_committee": 301,
        "town_committee": 235,
        # Seven Cantonment Boards cross district boundaries, so this
        # district-keyed validation sees 50 records representing 43 boards.
        "cantonment": 50,
    }
    if counts != expected:
        raise SystemExit(f"市政机构分类变化：{dict(sorted(counts.items()))}")

    included = [
        row
        for row in bodies.values()
        if row["body_type"]
        in {
            "metropolitan_corporation",
            "municipal_corporation",
            "district_municipal_corporation",
            "municipal_committee",
        }
    ]
    if len(included) != 337:
        raise SystemExit(f"城市级市政机构应为 337 个，实际为 {len(included)}")
    return included


def parse_geonames(path: Path) -> list[dict[str, str]]:
    rows = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            fields = line.rstrip("\n").split("\t")
            names_list = [fields[1], fields[2], *fields[3].split(",")]
            rows.append(
                {
                    "id": fields[0],
                    "name": fields[1],
                    "ascii_name": fields[2],
                    "alternate_names": fields[3],
                    "latitude": fields[4],
                    "longitude": fields[5],
                    "feature_class": fields[6],
                    "feature_code": fields[7],
                    "admin1": fields[10],
                    "admin2": fields[11],
                    "_names": [value for value in names_list if value],
                    "_normalized_names": {
                        normalized_name(value) for value in names_list if value
                    },
                }
            )
    return rows


def names(place: dict[str, str]) -> list[str]:
    return place["_names"]


def best_name_score(target: str, place: dict[str, str]) -> float:
    return max(similarity(target, name) for name in names(place) if name)


def district_keys(
    census_rows: list[dict[str, str]], geonames_rows: list[dict[str, str]]
) -> dict[str, tuple[str, str]]:
    districts = [row for row in geonames_rows if row["feature_code"] == "ADM2"]
    result = {}
    for district in sorted({row["district"] for row in census_rows}):
        if district in DISTRICT_KEY_OVERRIDES:
            result[district] = DISTRICT_KEY_OVERRIDES[district]
            continue
        target = DISTRICT_ALIASES.get(district, district)
        match = max(districts, key=lambda row: best_name_score(target, row))
        score = best_name_score(target, match)
        if score < 0.8:
            raise SystemExit(
                f"无法可靠匹配行政区 {district}：{match['name']}（{score:.3f}）"
            )
        result[district] = (match["admin1"], match["admin2"])
    return result


def select_point(
    row: dict[str, str],
    places_by_id: dict[str, dict[str, str]],
    places_by_district: dict[tuple[str, str], list[dict[str, str]]],
    places_by_admin1: dict[str, list[dict[str, str]]],
    district_key: tuple[str, str],
) -> tuple[dict[str, str], float]:
    override_id = POINT_OVERRIDES.get((row["district"], row["name"]))
    if override_id:
        return places_by_id[override_id], 1.0
    manual_point = MANUAL_POINT_OVERRIDES.get((row["district"], row["name"]))
    if manual_point:
        return manual_point, 1.0

    admin1, admin2 = district_key
    in_district = places_by_district.get((admin1, admin2), [])

    # Keep automatic matches inside the official district (or its explicit
    # former-parent alias); boundary anomalies are handled only by overrides.
    target = normalized_name(row["name"])
    exact = [
        place for place in in_district if target in place["_normalized_names"]
    ]
    if exact:
        return max(exact, key=lambda place: int(place.get("id", "0"))), 1.0

    if not in_district:
        raise SystemExit(f"{row['district']} / {row['name']} 没有区内候选中心点")
    district_match = max(in_district, key=lambda place: best_name_score(row["name"], place))
    district_score = best_name_score(row["name"], district_match)
    return district_match, district_score


def build_rows(
    census_rows: list[dict[str, str]], geonames_rows: list[dict[str, str]]
) -> list[dict[str, str]]:
    places_by_id = {row["id"]: row for row in geonames_rows}
    places_by_district = {}
    places_by_admin1 = {}
    for place in geonames_rows:
        if place["feature_class"] != "P":
            continue
        places_by_district.setdefault((place["admin1"], place["admin2"]), []).append(place)
        places_by_admin1.setdefault(place["admin1"], []).append(place)
    keys = district_keys(census_rows, geonames_rows)
    output = []
    low_confidence = []
    for row in census_rows:
        point, score = select_point(
            row,
            places_by_id,
            places_by_district,
            places_by_admin1,
            keys[row["district"]],
        )
        if score < 0.78:
            raise SystemExit(
                f"{row['district']} / {row['name']} 低置信匹配到 "
                f"{point['name']}（{score:.3f}）"
            )
        if score < 0.9:
            low_confidence.append((row["district"], row["name"], point["name"], score))
        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (60 <= longitude <= 78 and 23 <= latitude <= 38):
            raise SystemExit(f"{row['name']} 中心点超出巴基斯坦范围")
        admin1 = keys[row["district"]][0]
        output.append(
            {
                "administrative_code": administrative_code(
                    f"{row['district']}-{row['name']}-{row['body_type']}"
                ),
                "name": row["name"].title(),
                "admin_area": row["district"].title(),
                "city_level": row["body_type"],
                "geonames_id": point["id"],
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
                "province": ADMIN1_NAMES.get(admin1, admin1),
            }
        )

    ids = [row["administrative_code"] for row in output]
    if len(ids) != len(set(ids)):
        raise SystemExit("生成结果存在重复稳定 ID")
    point_ids = [row["geonames_id"] for row in output if row["geonames_id"]]
    duplicates = sorted(key for key, count in Counter(point_ids).items() if count > 1)
    if duplicates:
        details = [
            (row["admin_area"], row["name"], row["geonames_id"])
            for row in output
            if row["geonames_id"] in duplicates
        ]
        raise SystemExit(f"多个城市错误共用同一中心点：{details}")

    if low_confidence:
        print("需要人工复核的拼写映射：")
        for district, city, point, score in low_confidence:
            print(f"  {district} / {city} -> {point} ({score:.3f})")
    return sorted(output, key=lambda row: (row["province"], row["admin_area"], row["name"]))


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
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-pakistan-municipal-cities.py "
            "<table_2_national.xlsx> <PK.txt> [output.csv]"
        )
    census_path = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    require_hash(census_path, EXPECTED_CENSUS_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    rows = build_rows(parse_census(census_path), parse_geonames(geonames_path))
    write_csv(rows, output_path)
    print(f"已生成 {len(rows)} 个巴基斯坦城市级市政机构中心点")


if __name__ == "__main__":
    main()
