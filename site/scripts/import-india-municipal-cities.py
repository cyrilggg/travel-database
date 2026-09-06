#!/usr/bin/env python3
"""Build India's city-level municipal catalog from pinned LGD snapshots.

Usage:
  py -3.12 scripts/import-india-municipal-cities.py \
    <urban_local_bodies.csv> <statewise_ulbs_coverage.csv> <IN.txt> \
    <wikidata-lgd-coordinates.json> <nominatim-review.json> [output.csv]

The LGD snapshots are the 2026-09-05 Government of India directory exports.
This catalog keeps Municipal Corporations, Municipalities, City Municipal
Councils and New Delhi Municipal Council. Town/transition bodies and notified
areas are intentionally outside the global city-level scope.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


EXPECTED_ULB_HASH = (
    "A176B29B39A086653377952EC08AF18A0B43B47E21358F5DAC5BCF1F5E8084DA"
)
EXPECTED_COVERAGE_HASH = (
    "ABB6F164FB6C9B9BB6649F5914CB0381C33CDD535E805A0D96C365D232FB9AFD"
)
EXPECTED_GEONAMES_HASH = (
    "3685B3E00AA99B607D0B9B1465B348E231835654FA3C225983F13E49668B07FC"
)
EXPECTED_WIKIDATA_HASH = (
    "E9C7265DE004B18E495A4F99425CA49A601F3092599B5D0347E1BB114A232C1A"
)
EXPECTED_NOMINATIM_HASH = (
    "FE8F4B23765BB0E2C1C1A46C9325F91C1ECA0BD32DC19104D8181E69B0EBCDBF"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = SCRIPT_DIR.parent / "data" / "sources" / "in-municipal-cities-2026-09-05.csv"

INCLUDED_TYPE_CODES = {
    "4": "municipal_corporation",
    "5": "municipality",
    "21": "municipal_council",
    "24": "city_municipal_council",
}
EXPECTED_ALL_TYPE_COUNTS = {
    "4": 273,
    "5": 2006,
    "6": 166,
    "7": 2420,
    "21": 1,
    "24": 66,
    "25": 118,
}

STATE_ALIASES = {
    "Andaman And Nicobar Islands": "Andaman and Nicobar Islands",
    "Chandigarh": "Chandigarh",
    "Delhi": "Delhi",
    "The Dadra And Nagar Haveli And Daman And Diu": "Dadra and Nagar Haveli and Daman and Diu",
}

# Delhi's three former corporations were merged into the Municipal Corporation
# of Delhi in 2022, although LGD still exposes the three predecessor records.
FORMER_DELHI_CODES = {"276400", "276401", "276402"}

# The September 2026 LGD export still contains 23 of the 27 Hyderabad-area
# bodies dissolved into expanded GHMC in December 2025. The other four have
# already disappeared, and the February 2026 successor corporations
# (Cyberabad and Malkajgiri) are already present in LGD.
FORMER_HYDERABAD_CODES = {
    "257864",  # Pedda Amberpet
    "276409",  # Jalapally
    "290149",  # Shamshabad
    "290150",  # Turkayamjal
    "290096",  # Manikonda
    "290097",  # Narsingi
    "290099",  # Adibatla
    "290102",  # Thukkuguda
    "263222",  # Medchal
    "290081",  # Dammaiguda
    "290082",  # Nagaram
    "290083",  # Pocharam
    "290084",  # Ghatkesar
    "290085",  # Gundlapochampally
    "290086",  # Thumkunta
    "290088",  # Kompally
    "290154",  # Dundigal
    "290151",  # Bollaram
    "290152",  # Tellapur
    "290153",  # Ameenpur
    "257865",  # Badangpet
    "290098",  # Bandlaguda Jagir
    "276410",  # Meerpet
}

POINT_OVERRIDES = {
    "MCD": "1273294",       # Delhi
    "276447": "1261481",   # New Delhi
    "253270": "1278201",   # Atmakur (Kurnool)
    "299171": "1266975",   # Haweli Kharagpur / Kharagpur
    "299148": "1255382",   # Suryagadha / Surajgarha
    "299657": "10448167",  # Amleshwar / Amlesar
    "300355": "13156956",  # Mandir Hasod / Mandir Hasaud
    "297099": "1262497",   # Mundra-Baroi / Mundra
    "251245": "13157141",  # Navsari-Vijalpor / Vijalpor
    "296990": "1279192",   # Ashmuqam / Aish Maqam
    "276463": "6695467",   # Hebbugodi / Hebbagodi
    "293809": "1261645",   # Ganjbasoda / Nawab Basoda
    "303127": "10214227",  # Digdoh Devi / Digdoh
    "251281": "1272411",   # Dondaicha-Warwade / Dondaicha
    "303134": "8441972",   # Fursungi Uruli Devachi / Uruli Devachi
    "251350": "10469715",  # Kanhan-Pipri / Kanhan
    "251558": "1272819",   # Kille Dharur / Dharur
    "251622": "1265539",   # Kurundvad / Kurandvad
    "298893": "8441809",   # Mahalung Shripur / Mahalung
    "259704": "10522493",  # Ner Nababpur / Nababpur
    "251506": "1278293",   # Roha Ashtami / Ashtami
    "251280": "1256475",   # Shirpur-Warwade / Shirpur
    "276550": "12523388",  # Thongkhong Laxmi / Wangoi (alternate name)
    "276511": "1252964",   # Wangjing Lamding / Wangjing
    "250548": "1276686",   # Boudhgarh / Baud
    "301445": "1263282",   # Mawali / Mavli
    "296922": "1259347",   # Paota-Pragpura / Pragpura
    "301451": "12685459",  # Sikaray / Sikrai
    "252920": "11461524",  # Gudalur-Cbe / Gudalur, Coimbatore
    "302811": "1445568",   # Aliyadbad / Aliabad
    "290073": "1275024",   # Bhootpur / Buthpur
    "290076": "10916655",  # Kyathanpally (GeoNames alternate name)
    "290145": "1445396",   # Pochamapally / Pochampalli
    "302809": "1445678",   # Yellapet / Ellampet
    "248441": "1266014",   # Kanvnagri Kotdwar / Kotdwara
    "248465": "10575956",  # Mahua Kheraganj / Mahuakheraganj
    "277190": "1258455",   # Ranikhet Chiliyanaula / Ranikhet
    "274820": "10265221",  # Khoda Makanpur / Khora
    "249462": "1276972",   # Gaura Barhaj / Barhaj
    "249187": "1262988",   # Misrikh Cum Neemsar / Misrikh
    "249180": "1262629",   # Mohammadi / Muhamdi
    "249518": "1262634",   # Pt Deen Dayal Nagar / Mughalsarai
    "249427": "1261687",   # Siddharth Nagar (Tetri Bazar) / Naugarh
    "250174": "1348675",   # Champdany / Champdani
    "249988": "1271670",   # Gangarampore / Gangarampur
    "249982": "1269665",   # Islampore / Islampur
    "249135": "1277814",   # Bahedi / Baheri
    "297027": "1271780",   # Gajralua / Gajraula
}

# These municipal centers were checked against a second public map or
# government document because the pinned GeoNames archive either lacks the
# locality or resolves the official LGD spelling to a different place.
MANUAL_POINT_OVERRIDES = {
    "289553": ("Ramkrishna Nagar", "92.461800", "24.566400"),
    "301510": ("Banki Mongra", "82.602416", "22.405911"),
    "276550": ("Thongkhong Laxmi Bazar", "93.901667", "24.633889"),
    "276549": ("Wangoi", "93.898794", "24.658616"),
    "248426": ("Muni Ki Reti-Dhalwala", "78.166667", "30.066667"),
    "262858": ("Shivalik Nagar", "78.076870", "29.934020"),
    "305322": ("Sirauli Kalan", "79.510542", "28.894613"),
    "297022": ("Gangaghat (Shuklaganj)", "80.402778", "26.499444"),
    "305853": ("Bengaluru North City Corporation", "77.593880", "13.067360"),
    "305854": ("Bengaluru West City Corporation", "77.516040", "12.928150"),
    "250142": ("North Dum Dum", "88.419070", "22.652080"),
    "250144": ("South Dum Dum", "88.394493", "22.607672"),
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
    value = value.replace("&", "and").replace("’", "").replace("'", "")
    value = re.sub(r"\((?:m|mc|municipality|municipal council)\)", "", value)
    for phrase in (
        "city municipal corporation",
        "municipal corporation",
        "city municipal council",
        "municipal council",
        "municipal committee",
        "municipality",
        "nagar palika parishad",
        "nagar parishad",
        "nagar palika",
        "district",
        "state of",
        "union territory of",
        "the",
    ):
        value = value.replace(phrase, "")
    return "".join(character for character in value if character.isalnum())


def similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalized_name(left), normalized_name(right)).ratio()


def display_name(value: str) -> str:
    value = re.sub(r"\((?:M|MC|Municipality|Municipal Council)\)$", "", value).strip()
    return value.title() if value.isupper() else value


def parse_ulbs(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    counts = Counter(row["Localbody Type Code"] for row in rows)
    if counts != EXPECTED_ALL_TYPE_COUNTS:
        raise SystemExit(f"LGD 城市机构分类变化：{dict(sorted(counts.items()))}")

    selected = []
    for row in rows:
        code = row["Local Body Code"]
        type_code = row["Localbody Type Code"]
        if (
            type_code not in INCLUDED_TYPE_CODES
            or code in FORMER_DELHI_CODES
            or code in FORMER_HYDERABAD_CODES
        ):
            continue
        selected.append(
            {
                "code": code,
                "name": row["Local Body Name (In English)"].strip(),
                "state": row["State Name"].strip(),
                "state_code": row["State Code"],
                "city_level": INCLUDED_TYPE_CODES[type_code],
            }
        )

    selected.append(
        {
            "code": "MCD",
            "name": "Delhi",
            "state": "Delhi",
            "state_code": "7",
            "city_level": "municipal_corporation",
        }
    )
    if len(selected) != 2321:
        raise SystemExit(f"城市级自治体应为 2321 个，实际为 {len(selected)}")
    return selected


def parse_coverage(path: Path) -> dict[str, list[tuple[str, str]]]:
    result = defaultdict(list)
    seen = defaultdict(set)
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            code = row["Local Body Code"]
            district = (
                row["District Code"].strip(),
                row["District Name (In English)"].strip(),
            )
            if district[0] and district not in seen[code]:
                result[code].append(district)
                seen[code].add(district)
    return result


def parse_geonames(path: Path) -> list[dict[str, object]]:
    rows = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            fields = line.rstrip("\n").split("\t")
            names = [fields[1], fields[2], *fields[3].split(",")]
            rows.append(
                {
                    "id": fields[0],
                    "name": fields[1],
                    "latitude": fields[4],
                    "longitude": fields[5],
                    "feature_class": fields[6],
                    "feature_code": fields[7],
                    "admin1": fields[10],
                    "admin2": fields[11],
                    "names": [name for name in names if name],
                    "normalized_names": {
                        normalized_name(name) for name in names if name
                    },
                }
            )
    return rows


def parse_wikidata_points(path: Path) -> dict[str, dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    candidates = defaultdict(list)
    for binding in data["results"]["bindings"]:
        match = re.fullmatch(
            r"Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)",
            binding["coord"]["value"],
        )
        if not match:
            raise SystemExit(f"无法解析 Wikidata 坐标：{binding['coord']['value']}")
        candidates[binding["code"]["value"]].append(
            {
                "id": "",
                "wikidata_id": binding["item"]["value"].rsplit("/", 1)[-1],
                "name": binding["item"]["value"].rsplit("/", 1)[-1],
                "longitude": match[1],
                "latitude": match[2],
            }
        )
    # Prefer the most precise truthy coordinate when Wikidata exposes multiple
    # coordinate statements for the same municipal item.
    return {
        code: max(
            points,
            key=lambda point: (
                len(str(point["longitude"])) + len(str(point["latitude"])),
                str(point["wikidata_id"]),
            ),
        )
        for code, points in candidates.items()
    }


def parse_nominatim_points(path: Path) -> dict[str, dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    result = {}
    for code, entry in data["entries"].items():
        if not entry["results"]:
            continue
        point = entry["results"][0]
        if point.get("address", {}).get("country_code") != "in":
            raise SystemExit(f"Nominatim {code} 返回了非印度结果")
        result[code] = {
            "id": "",
            "osm_id": f"{point['osm_type']}/{point['osm_id']}",
            "name": point["display_name"],
            "longitude": point["lon"],
            "latitude": point["lat"],
        }
    return result


def best_score(target: str, place: dict[str, object]) -> float:
    return max(similarity(target, name) for name in place["names"])


def map_states(
    ulbs: list[dict[str, str]], geonames: list[dict[str, object]]
) -> dict[str, str]:
    admin1_rows = [row for row in geonames if row["feature_code"] == "ADM1"]
    result = {}
    for state in sorted({row["state"] for row in ulbs}):
        target = STATE_ALIASES.get(state, state)
        match = max(admin1_rows, key=lambda place: best_score(target, place))
        score = best_score(target, match)
        if score < 0.9:
            raise SystemExit(f"无法匹配邦/联邦属地 {state}：{match['name']} ({score:.3f})")
        result[state] = str(match["admin1"])
    return result


def map_districts(
    ulbs: list[dict[str, str]],
    coverage: dict[str, list[tuple[str, str]]],
    state_keys: dict[str, str],
    geonames: list[dict[str, object]],
) -> tuple[dict[tuple[str, str], tuple[str, str]], list[tuple[str, str, str, float]]]:
    admin2_by_state = defaultdict(list)
    for row in geonames:
        if row["feature_code"] == "ADM2":
            admin2_by_state[row["admin1"]].append(row)

    state_by_code = {row["code"]: row["state"] for row in ulbs}
    result = {}
    weak = []
    for code, districts in coverage.items():
        state = state_by_code.get(code)
        if not state:
            continue
        admin1 = state_keys[state]
        for district_code, district_name in districts:
            key = (admin1, district_code)
            if key in result:
                continue
            candidates = admin2_by_state[admin1]
            match = max(candidates, key=lambda place: best_score(district_name, place))
            score = best_score(district_name, match)
            result[key] = (admin1, str(match["admin2"]))
            if score < 0.82:
                weak.append((state, district_name, str(match["name"]), score))
    return result, sorted(set(weak))


def choose_point(
    row: dict[str, str],
    coverage: dict[str, list[tuple[str, str]]],
    state_key: str,
    district_keys: dict[tuple[str, str], tuple[str, str]],
    places_by_state: dict[str, list[dict[str, object]]],
    places_by_district: dict[tuple[str, str], list[dict[str, object]]],
    places_by_id: dict[str, dict[str, object]],
    wikidata_points: dict[str, dict[str, object]],
    nominatim_points: dict[str, dict[str, object]],
) -> tuple[dict[str, object], float, str]:
    manual = MANUAL_POINT_OVERRIDES.get(row["code"])
    if manual:
        name, longitude, latitude = manual
        return {
            "id": "",
            "name": name,
            "longitude": longitude,
            "latitude": latitude,
        }, 1.0, "manual-review"
    override = POINT_OVERRIDES.get(row["code"])
    if override:
        return places_by_id[override], 1.0, "override"
    if row["code"] in wikidata_points:
        return wikidata_points[row["code"]], 1.0, "wikidata-lgd"
    if row["code"] in nominatim_points:
        return nominatim_points[row["code"]], 1.0, "nominatim-review"

    district_candidates = []
    for district_code, _ in coverage.get(row["code"], []):
        mapped_key = district_keys.get((state_key, district_code))
        if mapped_key:
            district_candidates.extend(places_by_district.get(mapped_key, []))
    state_candidates = places_by_state[state_key]
    target = normalized_name(row["name"])

    exact_district = [
        place for place in district_candidates if target in place["normalized_names"]
    ]
    if exact_district:
        return max(exact_district, key=lambda place: int(place["id"])), 1.0, "district-exact"

    exact_state = [
        place for place in state_candidates if target in place["normalized_names"]
    ]
    if len(exact_state) == 1:
        return exact_state[0], 1.0, "state-exact"
    if len(exact_state) > 1 and district_candidates:
        district_ids = {place["id"] for place in district_candidates}
        exact_near = [place for place in exact_state if place["id"] in district_ids]
        if exact_near:
            return max(exact_near, key=lambda place: int(place["id"])), 1.0, "district-exact"

    candidates = district_candidates or state_candidates
    match = max(candidates, key=lambda place: best_score(row["name"], place))
    return match, best_score(row["name"], match), "district-fuzzy" if district_candidates else "state-fuzzy"


def build_rows(
    ulbs: list[dict[str, str]],
    coverage: dict[str, list[tuple[str, str]]],
    geonames: list[dict[str, object]],
    wikidata_points: dict[str, dict[str, object]],
    nominatim_points: dict[str, dict[str, object]],
) -> list[dict[str, str]]:
    state_keys = map_states(ulbs, geonames)
    district_keys, weak_districts = map_districts(ulbs, coverage, state_keys, geonames)
    if weak_districts:
        print("低置信行政区映射：")
        for state, official, mapped, score in weak_districts:
            print(f"  {state} / {official} -> {mapped} ({score:.3f})")

    places_by_state = defaultdict(list)
    places_by_district = defaultdict(list)
    places_by_id = {}
    for place in geonames:
        places_by_id[place["id"]] = place
        if place["feature_class"] != "P":
            continue
        places_by_state[place["admin1"]].append(place)
        places_by_district[(place["admin1"], place["admin2"])].append(place)

    output = []
    weak_points = []
    methods = Counter()
    for row in ulbs:
        state_key = state_keys[row["state"]]
        point, score, method = choose_point(
            row,
            coverage,
            state_key,
            district_keys,
            places_by_state,
            places_by_district,
            places_by_id,
            wikidata_points,
            nominatim_points,
        )
        methods[method] += 1
        if score < 0.72:
            weak_points.append((row["code"], row["state"], row["name"], point["name"], score))
            continue
        if score < 0.9:
            weak_points.append((row["code"], row["state"], row["name"], point["name"], score))
        longitude = float(point["longitude"])
        latitude = float(point["latitude"])
        if not (68 <= longitude <= 98 and 6 <= latitude <= 38):
            raise SystemExit(f"{row['state']} / {row['name']} 中心点超出印度范围")
        output.append(
            {
                "administrative_code": row["code"],
                "name": display_name(row["name"]),
                "admin_area": row["state"],
                "city_level": row["city_level"],
                "geonames_id": str(point["id"]),
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
            }
        )

    print("中心点映射方式：", dict(sorted(methods.items())))
    if weak_points:
        print(f"低置信/未生成中心点：{len(weak_points)}")
        for code, state, official, mapped, score in weak_points:
            print(f"  {code} | {state} | {official} -> {mapped} ({score:.3f})")
    if len(output) != len(ulbs):
        raise SystemExit(f"有 {len(ulbs) - len(output)} 个城市缺少可靠中心点")
    if len({row["administrative_code"] for row in output}) != len(output):
        raise SystemExit("生成结果存在重复 LGD 稳定 ID")
    duplicates = [
        point_id
        for point_id, count in Counter(
            row["geonames_id"] for row in output if row["geonames_id"]
        ).items()
        if count > 1
    ]
    if duplicates:
        details = [
            (row["administrative_code"], row["admin_area"], row["name"], row["geonames_id"])
            for row in output
            if row["geonames_id"] in duplicates
        ]
        raise SystemExit(f"多个城市共用中心点（{len(duplicates)} 组）：{details}")
    coordinate_duplicates = [
        coordinates
        for coordinates, count in Counter(
            (row["longitude"], row["latitude"]) for row in output
        ).items()
        if count > 1
    ]
    if coordinate_duplicates:
        details = [
            (
                row["administrative_code"],
                row["admin_area"],
                row["name"],
                row["longitude"],
                row["latitude"],
            )
            for row in output
            if (row["longitude"], row["latitude"]) in coordinate_duplicates
        ]
        raise SystemExit(
            f"多个城市共用完全相同的中心坐标（{len(coordinate_duplicates)} 组）：{details}"
        )
    return sorted(output, key=lambda row: (row["admin_area"], row["name"], row["administrative_code"]))


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
    if len(sys.argv) not in {6, 7}:
        raise SystemExit(
            "用法：py -3.12 scripts/import-india-municipal-cities.py "
            "<urban_local_bodies.csv> <statewise_ulbs_coverage.csv> <IN.txt> "
            "<wikidata-lgd-coordinates.json> <nominatim-review.json> [output.csv]"
        )
    ulb_path = Path(sys.argv[1]).resolve()
    coverage_path = Path(sys.argv[2]).resolve()
    geonames_path = Path(sys.argv[3]).resolve()
    wikidata_path = Path(sys.argv[4]).resolve()
    nominatim_path = Path(sys.argv[5]).resolve()
    output_path = Path(sys.argv[6]).resolve() if len(sys.argv) == 7 else DEFAULT_OUTPUT
    require_hash(ulb_path, EXPECTED_ULB_HASH)
    require_hash(coverage_path, EXPECTED_COVERAGE_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)
    require_hash(wikidata_path, EXPECTED_WIKIDATA_HASH)
    require_hash(nominatim_path, EXPECTED_NOMINATIM_HASH)
    rows = build_rows(
        parse_ulbs(ulb_path),
        parse_coverage(coverage_path),
        parse_geonames(geonames_path),
        parse_wikidata_points(wikidata_path),
        parse_nominatim_points(nominatim_path),
    )
    write_csv(rows, output_path)
    print(f"已生成 {len(rows)} 个印度城市级自治体中心点")


if __name__ == "__main__":
    main()
