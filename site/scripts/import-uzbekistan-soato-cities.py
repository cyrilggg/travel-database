#!/usr/bin/env python3
"""Build Uzbekistan's current statutory city catalog from SOATO snapshots.

Usage:
  py -3.12 scripts/import-uzbekistan-soato-cities.py \
    <sdmx_data_290.csv> <soato-nrm-2017.html> <UZ.txt> [output.csv]

The detailed SOATO transcription pins the complete 119-city 2017 baseline.
The current official SIAT series then validates the 2026 total and regional
counts; the documented 2018/2020 administrative changes are applied below.
"""

from __future__ import annotations

import csv
import difflib
import hashlib
import html
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path


EXPECTED_SIAT_HASH = (
    "064B72C9C05E28FFAA902DD35FA982B613AC6D120B557E255EBF5AF3C5219487"
)
EXPECTED_SOATO_HASH = (
    "E8D4D41C7EA6B082090A6FE70C05E8C1BF2A90176193D781223075F931FAB0C6"
)
EXPECTED_GEONAMES_HASH = (
    "139865976D1228BB0C16579F50CDF08346726B528907945311797BC6987B8F4F"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent / "data" / "sources" / "uz-soato-cities-2026-06-12.csv"
)

# SOATO region code, display name, GeoNames admin1, expected current city count.
REGIONS = {
    "1703": ("Andijan Region", "01", 11),
    "1706": ("Bukhara Region", "02", 11),
    "1708": ("Jizzakh Region", "15", 6),
    "1710": ("Qashqadaryo Region", "08", 12),
    "1712": ("Navoiy Region", "07", 7),
    "1714": ("Namangan Region", "06", 8),
    "1718": ("Samarqand Region", "10", 11),
    "1722": ("Surxondaryo Region", "12", 8),
    "1724": ("Sirdaryo Region", "16", 5),
    "1726": ("Tashkent", "13", 1),
    "1727": ("Tashkent Region", "14", 16),
    "1730": ("Fergana Region", "03", 9),
    "1733": ("Xorazm Region", "05", 3),
    "1735": ("Karakalpakstan", "09", 12),
}

# Former district-level code -> current regional-level code and current name.
PROMOTIONS = {
    "1727212501": ("1727415", "Ohangaron"),
    "1727253501": ("1727401", "Nurafshon"),
    "1727259501": ("1727424", "Yangiyo‘l"),
}

# The sole net addition after the 119-city baseline.
ADDITIONS = [("1712412", "Gʻozgʻon", "regional_significance_city")]

# Current legal names whose GeoNames entry is still primarily indexed by an
# older or alternative spelling.
POINT_OVERRIDES: dict[str, str] = {
    "1703211501": "1514109",
    "1703230501": "1512832",
    "1703408": "1513578",
    "1706204501": "1217907",
    "1706207501": "1217340",
    "1706212501": "1512423",
    "1706215501": "1513983",
    "1706242501": "1216290",
    "1706242505": "1513990",
    "1706258501": "1512838",
    "1708209501": "1514008",
    "1708215501": "1514125",
    "1708228501": "1513038",
    "1710220501": "1217144",
    "1710235501": "1346493",
    "1710235505": "1346490",
    "1710242501": "1217540",
    "1712248501": "1538231",
    "1712251501": "1512348",
    "1714207501": "1513714",
    "1714216501": "1513655",
    "1714219501": "1513023",
    "1714236501": "1514258",
    "1718206501": "1217658",
    "1718209501": "1217414",
    "1718212501": "1217215",
    "1718224501": "1216430",
    "1718227501": "1217362",
    "1718235501": "1216080",
    "1722210501": "1217474",
    "1722212501": "1217192",
    "1722217505": "1216177",
    "1722223501": "1216157",
    "1722226501": "1216115",
    "1724410": "1512808",
    "1727206501": "1514668",
    "1727228501": "1514330",
    "1727233501": "1512762",
    "1730215501": "1514382",
    "1730408": "1513331",
    "1735207501": "1514387",
    "1735212505": "829963",
    "1735215501": "601323",
    "1735228501": "829958",
    "1735240501": "829960",
}

DISPLAY_OVERRIDES = {
    "1703401": "Andijon",
    "1703408": "Xonobod",
    "1706401": "Buxoro",
    "1706403": "Kogon",
    "1708401": "Jizzax",
    "1710401": "Qarshi",
    "1710405": "Shahrisabz",
    "1712401": "Navoiy",
    "1712408": "Zarafshon",
    "1712412": "Gʻozgʻon",
    "1714401": "Namangan",
    "1718401": "Samarqand",
    "1718406": "Kattaqoʻrgʻon",
    "1722401": "Termiz",
    "1724401": "Guliston",
    "1724410": "Shirin",
    "1724413": "Yangiyer",
    "1727401": "Nurafshon",
    "1727404": "Olmaliq",
    "1727407": "Angren",
    "1727413": "Bekobod",
    "1727415": "Ohangaron",
    "1727419": "Chirchiq",
    "1727424": "Yangiyoʻl",
    "1730401": "Fargʻona",
    "1730405": "Qoʻqon",
    "1730408": "Quvasoy",
    "1730412": "Margʻilon",
    "1733220505": "Pitnak",
    "1733401": "Urganch",
    "1733406": "Xiva",
    "1735401": "Nukus",
}

CYRILLIC_TO_LATIN = str.maketrans(
    {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
        "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k",
        "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
        "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
        "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "",
        "э": "e", "ю": "yu", "я": "ya",
    }
)


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.fragments: list[str] = []

    def handle_data(self, data: str) -> None:
        self.fragments.extend(data.splitlines())


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
    return "".join(character for character in value if character.isalnum())


def transliterated_name(value: str) -> str:
    repaired = value.lower().replace("p", "р").replace("h", "н")
    return normalized_name(repaired.translate(CYRILLIC_TO_LATIN))


def parse_soato(path: Path) -> list[dict[str, str]]:
    extractor = TextExtractor()
    extractor.feed(path.read_text(encoding="utf-8"))
    lines = [
        re.sub(r"\s+", " ", html.unescape(fragment)).strip()
        for fragment in extractor.fragments
    ]
    lines = [line for line in lines if line]

    records: list[dict[str, str]] = []
    for index, code in enumerate(lines[:-1]):
        if re.fullmatch(r"17\d{2}4\d{2}", code) and not code.endswith("00"):
            records.append(
                {
                    "administrative_code": code,
                    "official_name": lines[index + 1],
                    "city_level": "regional_significance_city",
                }
            )
        elif re.fullmatch(r"17\d{8}", code) and 501 <= int(code[-3:]) <= 549:
            records.append(
                {
                    "administrative_code": code,
                    "official_name": lines[index + 1],
                    "city_level": "district_significance_city",
                }
            )

    if len(records) != 118:
        raise SystemExit(f"SOATO 2017 明细城市数变化：{len(records)}（预期 118，不含塔什干）")
    if Counter(record["city_level"] for record in records) != {
        "regional_significance_city": 27,
        "district_significance_city": 91,
    }:
        raise SystemExit("SOATO 2017 城市层级构成变化")

    records.append(
        {
            "administrative_code": "1726",
            "official_name": "Ташкент",
            "city_level": "republican_significance_city",
        }
    )
    return records


def apply_current_changes(records: list[dict[str, str]]) -> list[dict[str, str]]:
    current: list[dict[str, str]] = []
    for record in records:
        promoted = PROMOTIONS.get(record["administrative_code"])
        if promoted:
            code, name = promoted
            current.append(
                {
                    "administrative_code": code,
                    "official_name": name,
                    "city_level": "regional_significance_city",
                }
            )
        else:
            current.append(record)
    for code, name, level in ADDITIONS:
        current.append(
            {
                "administrative_code": code,
                "official_name": name,
                "city_level": level,
            }
        )
    if len(current) != 120 or len({row["administrative_code"] for row in current}) != 120:
        raise SystemExit("应用当前行政变更后未得到 120 个唯一城市")
    return current


def validate_siat(path: Path) -> None:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = {row["Code"]: row for row in csv.DictReader(source)}
    if float(rows["1700"]["2026"]) != 120:
        raise SystemExit("SIAT 当前全国城市总数不再是 120")
    actual = {
        code: int(float(rows[code]["2026"]))
        for code in REGIONS
    }
    expected = {code: region[2] for code, region in REGIONS.items()}
    if actual != expected:
        raise SystemExit(f"SIAT 当前地区城市计数变化：{actual}")


def validate_current_direct_codes(path: Path, records: list[dict[str, str]]) -> None:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    official = {
        row["Code"]
        for row in rows
        if re.search(r"shah(?:a)?r", row["Klassifikator"], re.IGNORECASE)
        and "tumani" not in row["Klassifikator"].lower()
        and float(row["2026"]) > 0
    }
    generated = {
        record["administrative_code"]
        for record in records
        if record["city_level"] != "district_significance_city"
    }
    if official != generated:
        raise SystemExit(
            f"当前直属城市代码不一致：缺少 {sorted(official - generated)}，"
            f"多出 {sorted(generated - official)}"
        )


def parse_geonames(
    path: Path,
) -> tuple[dict[str, dict[str, object]], dict[tuple[str, str], list[dict[str, object]]]]:
    by_id: dict[str, dict[str, object]] = {}
    by_admin_and_name: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    with path.open(encoding="utf-8") as source:
        for line in source:
            values = line.rstrip("\n").split("\t")
            if len(values) < 19 or values[6] != "P":
                continue
            place: dict[str, object] = {
                "id": values[0],
                "name": values[1],
                "ascii_name": values[2] or values[1],
                "latitude": values[4],
                "longitude": values[5],
                "feature_code": values[7],
                "admin1": values[10],
                "population": int(values[14] or 0),
                "keys": set(),
            }
            by_id[values[0]] = place
            for name in {values[1], values[2], *values[3].split(",")}:
                key = normalized_name(name)
                if key:
                    place["keys"].add(key)
                    by_admin_and_name[(values[10], key)].append(place)
    return by_id, by_admin_and_name


def point_rank(place: dict[str, object]) -> tuple[int, int, int]:
    important = int(str(place["feature_code"]) in {"PPLC", "PPLA", "PPLA2", "PPLA3"})
    return int(place["population"]), important, int(place["id"])


def candidate_names(record: dict[str, str]) -> set[str]:
    official = record["official_name"]
    # The archived Russian transcription contains a few Latin lookalikes.
    repaired = official.replace("p", "р").replace("H", "Н")
    names = {official, repaired}
    code = record["administrative_code"]
    if code == "1726":
        names.add("Tashkent")
    for old_code, (new_code, current_name) in PROMOTIONS.items():
        if code == new_code:
            names.add(current_name)
    for new_code, current_name, _ in ADDITIONS:
        if code == new_code:
            names.add(current_name)
    return names


def build_rows(
    records: list[dict[str, str]],
    by_id: dict[str, dict[str, object]],
    by_admin_and_name: dict[tuple[str, str], list[dict[str, object]]],
) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    unresolved: list[str] = []
    for record in records:
        code = record["administrative_code"]
        region_code = code[:4]
        admin_area, admin1, _ = REGIONS[region_code]
        override = POINT_OVERRIDES.get(code)
        if override:
            point = by_id.get(override)
            if point is None:
                raise SystemExit(f"固定中心点不存在：{code} -> {override}")
        else:
            candidates: dict[str, dict[str, object]] = {}
            for name in candidate_names(record):
                for point_value in by_admin_and_name.get((admin1, normalized_name(name)), []):
                    candidates[str(point_value["id"])] = point_value
            if not candidates:
                target = transliterated_name(record["official_name"])
                nearby = []
                for possible in by_id.values():
                    if possible["admin1"] != admin1:
                        continue
                    score = max(
                        (
                            difflib.SequenceMatcher(None, target, key).ratio()
                            for key in possible["keys"]
                        ),
                        default=0,
                    )
                    nearby.append((score, possible))
                suggestions = ", ".join(
                    f"{possible['id']}:{possible['ascii_name']}:{possible['feature_code']}:"
                    f"{possible['population']}:{score:.2f}"
                    for score, possible in sorted(nearby, reverse=True, key=lambda item: item[0])[:4]
                )
                unresolved.append(
                    f"{code}\t{record['official_name']}\t{admin_area}\t{suggestions}"
                )
                continue
            point = max(candidates.values(), key=point_rank)

        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (55 <= longitude <= 74 and 37 <= latitude <= 46):
            raise SystemExit(f"{code} / {record['official_name']} 中心点超出乌兹别克斯坦范围")
        output.append(
            {
                "administrative_code": code,
                "name": DISPLAY_OVERRIDES.get(
                    code,
                    re.sub(r"\s+Shahri$", "", str(point["ascii_name"]), flags=re.I),
                ).rstrip("'"),
                "admin_area": admin_area,
                "city_level": record["city_level"],
                "geonames_id": str(point["id"]),
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    if unresolved:
        raise SystemExit("城市没有行政区内精确中心点：\n" + "\n".join(unresolved))

    counts = Counter(row["admin_area"] for row in output)
    expected_counts = Counter({region[0]: region[2] for region in REGIONS.values()})
    if counts != expected_counts:
        raise SystemExit(f"生成结果地区计数变化：{dict(sorted(counts.items()))}")
    for field, values in (
        ("稳定 ID", [row["administrative_code"] for row in output]),
        ("GeoNames ID", [row["geonames_id"] for row in output]),
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
    if len(sys.argv) not in {4, 5}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-uzbekistan-soato-cities.py "
            "<sdmx_data_290.csv> <soato-nrm-2017.html> <UZ.txt> [output.csv]"
        )
    siat_path = Path(sys.argv[1]).resolve()
    soato_path = Path(sys.argv[2]).resolve()
    geonames_path = Path(sys.argv[3]).resolve()
    output_path = Path(sys.argv[4]).resolve() if len(sys.argv) == 5 else DEFAULT_OUTPUT
    require_hash(siat_path, EXPECTED_SIAT_HASH)
    require_hash(soato_path, EXPECTED_SOATO_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    validate_siat(siat_path)
    records = apply_current_changes(parse_soato(soato_path))
    validate_current_direct_codes(siat_path, records)
    by_id, by_admin_and_name = parse_geonames(geonames_path)
    rows = build_rows(records, by_id, by_admin_and_name)
    write_csv(rows, output_path)
    print("已生成 120 个乌兹别克斯坦法定城市中心点")


if __name__ == "__main__":
    main()
