#!/usr/bin/env python3
"""Build the Bangladesh urban-local-body map catalog from pinned source snapshots.

Usage:
  py -3.12 scripts/import-bangladesh-city-centers.py \
    <Paura-List.pdf> <BD.txt> [output.csv]

The PDF is the LGED division/category list. BD.txt is the extracted GeoNames
Bangladesh country dump. PDF extraction requires pypdf (`py -m pip install pypdf`).
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
    from pypdf import PdfReader
except ImportError as error:
    raise SystemExit("缺少 pypdf；请先运行 `py -m pip install pypdf`") from error


EXPECTED_OFFICIAL_PDF_HASH = (
    "2A7C8FBFDDD9603F1D00EB17D882786C5B068AECC54A7A8BE1A7C3E5459F2AFA"
)
EXPECTED_GEONAMES_HASH = (
    "04D29E3DB226675E5E29A5D83A1A36271B610C311BB078326EF93012E0F79A74"
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = (
    SCRIPT_DIR.parent
    / "data"
    / "sources"
    / "bd-urban-local-bodies-2026-09-06.csv"
)

DISTRICT_ALIASES = {
    "Barishal": "Barisal",
    "Bogura": "Bogra",
    "Chapai Nawabganj": "Chapai Nababganj",
    "Chattogram": "Chittagong",
    "Jashore": "Jessore",
    "Jhalokathi": "Jhalokati",
    "Laxmipur": "Lakshmipur",
    "Moulvibazar": "Maulvibazar",
    "Netrokona": "Netrakona",
}

# These spellings do not select the right record reliably by fuzzy matching.
# Values with no GeoNames ID are pinned representative urban points from the
# government/municipal map sources documented in data/README.md.
POINT_OVERRIDES = {
    ("Chandpur", "Matlab"): {"geonames_id": "1185278"},
    ("Chattogram", "Nazirhat"): {"geonames_id": "6414391"},
    ("Dinajpur", "Setabganj"): {"geonames_id": "1188233"},
    ("Jhalokathi", "Jhalakathi"): {"geonames_id": "11283340"},
    ("Pirojpur", "Shorupkathi"): {"geonames_id": "1477496"},
    ("Bogura", "Bogura CC"): {"geonames_id": "1337233"},
    ("Dhaka", "Dhaka South CC"): {"geonames_id": "1185241"},
    ("Chattogram", "Bariyarhat"): {
        "geonames_id": "",
        "latitude": 22.892964,
        "longitude": 91.519036,
    },
    ("Rajshahi", "Keshorehat"): {
        "geonames_id": "",
        "latitude": 24.590973,
        "longitude": 88.652191,
    },
    ("Dhaka", "Dhaka North CC"): {
        "geonames_id": "",
        "latitude": 23.785900,
        "longitude": 90.416800,
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
    for suffix in (
        "city corporation",
        "municipality",
        "pourashava",
        "paurashava",
        "paurasava",
        "district",
        "zila",
        "cc",
    ):
        value = value.replace(suffix, "")
    return "".join(character for character in value if character.isalnum())


def similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalized_name(left), normalized_name(right)).ratio()


def parse_official_rows(pdf_path: Path) -> list[dict[str, str]]:
    text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf_path).pages)
    text = text.replace("Cox��s", "Cox’s")
    for category in "ABC":
        text = text.replace(
            category + "List of Pourashava (Division and Category wise)SL No.",
            category + "\nSL No.",
        ).replace(category + "SL No.", category + "\nSL No.")
    text = text.replace("CCList Of City Corporations SL No.", "CC\nSL No.")

    row_pattern = re.compile(
        r"(?m)^(\d+)\s*\n([^\n]+?)\s*\n([^\n]+?)\s*\n"
        r"([^\n]+?)\s*\n(A|B|C|CC)\s*(?=\n|$)"
    )
    rows = [
        {
            "source_number": match[1],
            "division": match[2].strip(),
            "district": match[3].strip(),
            "name": match[4].strip(),
            "category": match[5],
        }
        for match in row_pattern.finditer(text)
    ]

    initial_counts = Counter(row["category"] for row in rows)
    if len(rows) != 340 or initial_counts["CC"] != 12:
        raise SystemExit(
            "官方 PDF 解析结果异常："
            f"共 {len(rows)} 行，分类为 {dict(sorted(initial_counts.items()))}"
        )

    # Bogura Pourashava was dissolved when Bogura City Corporation was gazetted
    # on 2026-05-14. The current LGD directory lists 13 city corporations.
    rows = [
        row
        for row in rows
        if not (row["category"] != "CC" and row["name"].lower() == "bogura")
    ]
    rows.append(
        {
            "source_number": "13",
            "division": "Rajshahi",
            "district": "Bogura",
            "name": "Bogura CC",
            "category": "CC",
        }
    )

    current_counts = Counter(row["category"] for row in rows)
    if len(rows) != 340 or current_counts["CC"] != 13:
        raise SystemExit("Bogura 改制校正后数量异常")
    return rows


def parse_geonames(path: Path) -> list[dict[str, str]]:
    rows = []
    with path.open(encoding="utf-8") as source:
        for line in source:
            fields = line.rstrip("\n").split("\t")
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
                }
            )
    return rows


def best_name_score(target: str, place: dict[str, str]) -> float:
    names = [place["name"], place["ascii_name"]]
    names.extend(place["alternate_names"].split(","))
    return max(similarity(target, name) for name in names if name)


def district_keys(
    official_rows: list[dict[str, str]], geonames_rows: list[dict[str, str]]
) -> dict[str, tuple[str, str]]:
    geonames_districts = [
        row for row in geonames_rows if row["feature_code"] == "ADM2"
    ]
    result = {}
    for district in sorted({row["district"] for row in official_rows}):
        target = DISTRICT_ALIASES.get(district, district)
        match = max(
            geonames_districts,
            key=lambda row: similarity(target, row["name"]),
        )
        score = similarity(target, match["name"])
        if score < 0.9:
            raise SystemExit(
                f"无法可靠匹配行政区 {district}：{match['name']}（{score:.3f}）"
            )
        result[district] = (match["admin1"], match["admin2"])
    return result


def map_point(
    row: dict[str, str],
    geonames_rows: list[dict[str, str]],
    geonames_by_id: dict[str, dict[str, str]],
    district_key: tuple[str, str],
) -> dict[str, str | float]:
    override = POINT_OVERRIDES.get((row["district"], row["name"]))
    if override is not None:
        geonames_id = override["geonames_id"]
        if geonames_id:
            place = geonames_by_id[geonames_id]
            return {
                "geonames_id": geonames_id,
                "longitude": float(place["longitude"]),
                "latitude": float(place["latitude"]),
            }
        return override

    admin1, admin2 = district_key
    candidates = [
        place
        for place in geonames_rows
        if place["admin1"] == admin1
        and place["admin2"] == admin2
        and place["feature_class"] in {"P", "A"}
        and place["feature_code"] not in {"ADM1", "ADM2"}
    ]
    if not candidates:
        raise SystemExit(f"{row['district']} / {row['name']} 没有候选中心点")
    match = max(candidates, key=lambda place: best_name_score(row["name"], place))
    score = best_name_score(row["name"], match)
    if score < 0.75:
        raise SystemExit(
            f"{row['district']} / {row['name']} 低置信匹配到 "
            f"{match['name']}（{score:.3f}）"
        )
    return {
        "geonames_id": match["id"],
        "longitude": float(match["longitude"]),
        "latitude": float(match["latitude"]),
    }


def stable_slug(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", value.upper()).strip("-")


def display_name(row: dict[str, str]) -> str:
    return re.sub(r"\s+CC$", "", row["name"]).strip()


def city_level(row: dict[str, str]) -> str:
    if row["category"] == "CC":
        if row["name"] in {"Dhaka North CC", "Dhaka South CC"}:
            return "capital_city_corporation"
        return "city_corporation"
    return f"pourashava_class_{row['category'].lower()}"


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit(__doc__)

    official_pdf = Path(sys.argv[1]).resolve()
    geonames_path = Path(sys.argv[2]).resolve()
    output_path = Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else DEFAULT_OUTPUT
    require_hash(official_pdf, EXPECTED_OFFICIAL_PDF_HASH)
    require_hash(geonames_path, EXPECTED_GEONAMES_HASH)

    official_rows = parse_official_rows(official_pdf)
    geonames_rows = parse_geonames(geonames_path)
    geonames_by_id = {row["id"]: row for row in geonames_rows}
    keys_by_district = district_keys(official_rows, geonames_rows)

    output_rows = []
    for row in official_rows:
        point = map_point(
            row,
            geonames_rows,
            geonames_by_id,
            keys_by_district[row["district"]],
        )
        name = display_name(row)
        body_suffix = "CC" if row["category"] == "CC" else "POURASHAVA"
        output_rows.append(
            {
                "administrative_code": "-".join(
                    (stable_slug(row["district"]), stable_slug(name), body_suffix)
                ),
                "name": name,
                "admin_area": row["district"],
                "city_level": city_level(row),
                "geonames_id": point["geonames_id"],
                "longitude": f"{float(point['longitude']):.6f}",
                "latitude": f"{float(point['latitude']):.6f}",
            }
        )

    codes = [row["administrative_code"] for row in output_rows]
    geonames_ids = [row["geonames_id"] for row in output_rows if row["geonames_id"]]
    if len(codes) != len(set(codes)):
        raise SystemExit("生成结果存在重复稳定 ID")
    if len(geonames_ids) != len(set(geonames_ids)):
        raise SystemExit("生成结果存在重复 GeoNames 标识")
    for row in output_rows:
        longitude = float(row["longitude"])
        latitude = float(row["latitude"])
        if not (88.0 <= longitude <= 93.0 and 20.0 <= latitude <= 27.5):
            raise SystemExit(f"{row['name']} 的中心点超出孟加拉国范围")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(
            target,
            fieldnames=(
                "administrative_code",
                "name",
                "admin_area",
                "city_level",
                "geonames_id",
                "longitude",
                "latitude",
            ),
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(output_rows)

    levels = Counter(row["city_level"] for row in output_rows)
    print(
        f"已生成 {len(output_rows)} 个孟加拉国城市级地方机构："
        + "、".join(f"{name}={count}" for name, count in sorted(levels.items()))
    )


if __name__ == "__main__":
    main()
