#!/usr/bin/env python3
"""Validate researched guides and both sparse China coverage ledgers."""

from __future__ import annotations

import argparse
import csv
from datetime import date
import json
import os
from pathlib import Path
import re
import sys
from typing import Iterable
from urllib.parse import unquote


REQUIRED_HEADINGS = (
    "城市速览",
    "城市格局与游览区域",
    "主要景点",
    "美食与餐饮",
    "经典行程",
    "住宿区域",
    "市内交通",
    "不同旅行者须知",
    "行前核对",
    "来源与更新记录",
)
ALLOWED_DECISION_STATUSES = {"researched", "duplicate", "merged", "out_of_scope"}
AUDIT_STATUSES = {"duplicate", "merged", "out_of_scope"}
MERGE_STATUSES = {"duplicate", "merged"}
BANNED_PHRASES = (
    "对用户",
    "适合你",
    "与妈妈同行",
    "根据已有画像",
    "清图范围",
)
PLACEHOLDER_PATTERNS = (
    re.compile(r"https://example\.com"),
    re.compile(r"YYYY-MM-DD"),
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"<!--.*?-->", re.DOTALL),
)
MOJIBAKE_MARKERS = ("ä¸", "å±", "æ—", "ç›", "â€", "Ã", "Â")
DIALOGUE_HEADING = re.compile(r"^#{2,3}\s+(?:先|怎样|怎么|是否|适不适合)")
FRONT_MATTER_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$")
LOCAL_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
TABLE_DELIMITER_CELL = re.compile(r"^:?-{3,}:?$")
FENCE_LINE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")


class ValidationFailure(RuntimeError):
    """Raised when validation cannot even start safely."""


def parse_front_matter(text: str, path: Path) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValidationFailure(f"{path}: unterminated front matter")
    result: dict[str, str] = {}
    for raw_line in text[4:end].splitlines():
        match = FRONT_MATTER_LINE.match(raw_line)
        if not match:
            continue
        key, raw_value = match.groups()
        value = raw_value.strip().strip('"').strip("'")
        result[key] = value
    return result


def markdown_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*.md")
        if ".git" not in path.parts and "raw" not in path.parts
    )


def parse_iso_date(value: str, label: str, errors: list[str]) -> None:
    try:
        date.fromisoformat(value)
    except ValueError:
        errors.append(f"{label}: expected ISO date, got {value!r}")


def validate_headings(path: Path, text: str, errors: list[str]) -> None:
    headings = [line[3:].strip() for line in text.splitlines() if line.startswith("## ")]
    positions: list[int] = []
    for heading in REQUIRED_HEADINGS:
        count = headings.count(heading)
        if count == 0:
            errors.append(f"{path}: missing required heading '## {heading}'")
            continue
        if count > 1:
            errors.append(f"{path}: duplicate required heading '## {heading}'")
        positions.append(headings.index(heading))
    if len(positions) == len(REQUIRED_HEADINGS) and positions != sorted(positions):
        errors.append(f"{path}: required headings are out of order")
    unexpected = [heading for heading in headings if heading not in REQUIRED_HEADINGS]
    if unexpected:
        errors.append(
            f"{path}: unexpected H2 headings: " + ", ".join(repr(item) for item in unexpected)
        )


def validate_copy(path: Path, text: str, errors: list[str]) -> None:
    if "中国" in path.parts and any(marker in text for marker in MOJIBAKE_MARKERS):
        errors.append(f"{path}: contains likely UTF-8 mojibake")
    for phrase in BANNED_PHRASES:
        if phrase in text:
            errors.append(f"{path}: contains banned personalized/workflow phrase {phrase!r}")
    for line_number, line in enumerate(text.splitlines(), start=1):
        if DIALOGUE_HEADING.match(line):
            errors.append(f"{path}:{line_number}: dialogue-style heading {line!r}")
    for pattern in PLACEHOLDER_PATTERNS:
        if pattern.search(text):
            errors.append(f"{path}: contains placeholder matching {pattern.pattern!r}")


def split_markdown_table_row(line: str) -> list[str] | None:
    """Return pipe-delimited cells, excluding optional outer pipes.

    A pipe preceded by an odd number of backslashes is escaped and remains in
    its cell. Indented code is deliberately excluded before table detection.
    """
    if line.startswith("\t") or len(line) - len(line.lstrip(" ")) >= 4:
        return None
    candidate = line.strip()
    separators: list[int] = []
    for index, character in enumerate(candidate):
        if character != "|":
            continue
        backslashes = 0
        cursor = index - 1
        while cursor >= 0 and candidate[cursor] == "\\":
            backslashes += 1
            cursor -= 1
        if backslashes % 2 == 0:
            separators.append(index)
    if not separators:
        return None

    cells: list[str] = []
    start = 0
    for separator in separators:
        cells.append(candidate[start:separator].strip())
        start = separator + 1
    cells.append(candidate[start:].strip())
    if separators[0] == 0:
        cells.pop(0)
    if separators[-1] == len(candidate) - 1:
        cells.pop()
    return cells or None


def fenced_code_lines(lines: list[str]) -> set[int]:
    """Return zero-based line indexes belonging to Markdown code fences."""
    fenced: set[int] = set()
    fence_character = ""
    fence_length = 0
    for index, line in enumerate(lines):
        match = FENCE_LINE.match(line)
        if not fence_character:
            if match:
                marker = match.group(1)
                fence_character = marker[0]
                fence_length = len(marker)
                fenced.add(index)
            continue
        fenced.add(index)
        if match:
            marker = match.group(1)
            if (
                marker[0] == fence_character
                and len(marker) >= fence_length
                and not match.group(2).strip()
            ):
                fence_character = ""
                fence_length = 0
    return fenced


def validate_markdown_tables(
    repository: Path, path: Path, text: str, errors: list[str]
) -> None:
    """Check column counts in recognized Markdown pipe-table blocks."""
    try:
        display_path = path.resolve().relative_to(repository.resolve()).as_posix()
    except ValueError:
        display_path = path.as_posix()

    lines = text.splitlines()
    fenced = fenced_code_lines(lines)
    index = 0
    while index + 1 < len(lines):
        if index in fenced or index + 1 in fenced:
            index += 1
            continue
        header = split_markdown_table_row(lines[index])
        delimiter = split_markdown_table_row(lines[index + 1])
        if (
            header is None
            or delimiter is None
            or not delimiter
            or not all(TABLE_DELIMITER_CELL.fullmatch(cell) for cell in delimiter)
        ):
            index += 1
            continue

        expected = len(header)
        if len(delimiter) != expected:
            errors.append(
                f"{display_path}:{index + 2}: table row has {len(delimiter)} columns; "
                f"expected {expected} from header on line {index + 1}"
            )

        row_index = index + 2
        while row_index < len(lines) and row_index not in fenced:
            row = split_markdown_table_row(lines[row_index])
            if row is None:
                break
            if len(row) != expected:
                errors.append(
                    f"{display_path}:{row_index + 1}: table row has {len(row)} columns; "
                    f"expected {expected} from header on line {index + 1}"
                )
            row_index += 1
        index = max(row_index, index + 2)


def validate_internal_links(repository: Path, path: Path, text: str, errors: list[str]) -> None:
    for raw_target in LOCAL_LINK.findall(text):
        target = raw_target.strip()
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = target.split("#", 1)[0].split("?", 1)[0]
        if not target:
            continue
        target = unquote(target).replace("/", os.sep)
        resolved = (path.parent / target).resolve()
        try:
            resolved.relative_to(repository.resolve())
        except ValueError:
            errors.append(f"{path}: local link escapes repository: {raw_target!r}")
            continue
        if not resolved.exists():
            errors.append(f"{path}: broken local link: {raw_target!r}")


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise ValidationFailure(f"missing required CSV: {path}")
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_legal_city_ledger(
    repository: Path,
    snapshot_date: str,
    city_pages: dict[str, tuple[Path, dict[str, str]]],
    errors: list[str],
) -> dict[str, object]:
    snapshot = repository / "coverage" / "legal-cities" / snapshot_date
    if not snapshot.is_dir():
        return {"available": False, "snapshot_date": snapshot_date}

    inventory_rows = read_csv(snapshot / "inventory" / "CN-legal-cities.csv")
    decisions = read_csv(snapshot / "decisions" / "CN.csv")
    inventory: dict[str, dict[str, str]] = {}
    for row_number, row in enumerate(inventory_rows, start=2):
        code = row.get("administrative_code", "")
        label = f"{snapshot / 'inventory' / 'CN-legal-cities.csv'}:{row_number}"
        if not re.fullmatch(r"\d{6}", code):
            errors.append(f"{label}: invalid six-digit administrative_code {code!r}")
            continue
        if code in inventory:
            errors.append(f"{label}: duplicate legal-city administrative_code {code}")
            continue
        if row.get("source_cutoff") != snapshot_date:
            errors.append(f"{label}: source_cutoff does not match snapshot directory")
        if row.get("city_level") not in {
            "direct_municipality",
            "prefecture_level_city",
            "county_level_city",
        }:
            errors.append(f"{label}: invalid city_level {row.get('city_level')!r}")
        inventory[code] = row

    decisions_by_code: dict[str, dict[str, str]] = {}
    mapped_geonames: dict[str, str] = {}
    level_counts = {
        level: 0
        for level in (
            "direct_municipality",
            "prefecture_level_city",
            "county_level_city",
        )
    }
    for row_number, row in enumerate(decisions, start=2):
        code = row.get("administrative_code", "")
        label = f"{snapshot / 'decisions' / 'CN.csv'}:{row_number}"
        if code in decisions_by_code:
            errors.append(f"{label}: duplicate legal-city decision for {code}")
            continue
        decisions_by_code[code] = row
        inventory_row = inventory.get(code)
        if inventory_row is None:
            errors.append(f"{label}: administrative_code is not present in legal-city inventory")
            continue
        if row.get("status") != "researched":
            errors.append(f"{label}: legal-city completed status must be 'researched'")
            continue
        for key in (
            "page_path",
            "geonameid",
            "reviewed_by",
            "reviewed_at",
            "quality_gate_version",
        ):
            if not row.get(key):
                errors.append(f"{label}: missing {key}")
        if row.get("reviewed_at"):
            parse_iso_date(row["reviewed_at"], label, errors)
        geonames_id = row.get("geonameid", "")
        if geonames_id in mapped_geonames:
            errors.append(
                f"{label}: geonameid {geonames_id} is already mapped from legal city "
                f"{mapped_geonames[geonames_id]}"
            )
        else:
            mapped_geonames[geonames_id] = code
        raw_page_path = row.get("page_path", "")
        page_path = repository / Path(raw_page_path)
        if not raw_page_path or not page_path.is_file():
            errors.append(f"{label}: researched page does not exist: {raw_page_path!r}")
            continue
        page = city_pages.get(geonames_id)
        if page is None or page[0].resolve() != page_path.resolve():
            errors.append(f"{label}: page front matter does not match geonameid/path")
            continue
        front_matter = page[1]
        if front_matter.get("country_code") != "CN":
            errors.append(f"{label}: legal-city page is not a CN page")
        if front_matter.get("city") != inventory_row.get("name"):
            errors.append(
                f"{label}: page city {front_matter.get('city')!r} does not match "
                f"legal-city name {inventory_row.get('name')!r}"
            )
        level = inventory_row.get("city_level", "")
        if level in level_counts:
            level_counts[level] += 1

    processed = sum(level_counts.values())
    return {
        "available": True,
        "snapshot_date": snapshot_date,
        "inventory_count": len(inventory),
        "decision_count": len(decisions_by_code),
        "researched_count": processed,
        "unprocessed_count": len(inventory) - processed,
        "completion_fraction": processed / len(inventory) if inventory else 0.0,
        "researched_counts_by_city_level": level_counts,
    }


def validate_repository(
    repository: Path,
    snapshot_date: str,
    legal_snapshot_date: str = "2025-12-31",
) -> dict[str, object]:
    errors: list[str] = []
    destinations = repository / "destinations"
    city_pages: dict[str, tuple[Path, dict[str, str]]] = {}

    for path in markdown_files(destinations):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            errors.append(f"{path}: not valid UTF-8: {exc}")
            continue
        try:
            front_matter = parse_front_matter(text, path)
        except ValidationFailure as exc:
            errors.append(str(exc))
            continue
        validate_copy(path, text, errors)
        if not front_matter:
            validate_internal_links(repository, path, text, errors)
            continue
        if front_matter.get("content_status") != "researched":
            continue

        required_keys = (
            "schema_version",
            "title",
            "country",
            "country_code",
            "admin_area",
            "city",
            "geonames_id",
            "last_researched",
            "content_status",
        )
        for key in required_keys:
            if not front_matter.get(key):
                errors.append(f"{path}: researched page is missing front-matter field {key!r}")
        geonames_id = front_matter.get("geonames_id", "")
        if not geonames_id.isdigit():
            errors.append(f"{path}: invalid geonames_id {geonames_id!r}")
        elif geonames_id in city_pages:
            errors.append(
                f"{path}: duplicate geonames_id {geonames_id}; "
                f"already used by {city_pages[geonames_id][0]}"
            )
        else:
            city_pages[geonames_id] = (path, front_matter)
        if front_matter.get("schema_version") != "1":
            errors.append(f"{path}: unsupported schema_version")
        if front_matter.get("last_researched"):
            parse_iso_date(front_matter["last_researched"], str(path), errors)
        validate_headings(path, text, errors)
        validate_markdown_tables(repository, path, text, errors)
        validate_internal_links(repository, path, text, errors)

    snapshot = repository / "coverage" / "geonames" / snapshot_date
    inventory_rows = read_csv(snapshot / "inventory" / "CN.csv")
    decisions = read_csv(snapshot / "decisions" / "CN.csv")
    inventory = {row["geonameid"]: row for row in inventory_rows}
    if len(inventory) != len(inventory_rows):
        errors.append("CN inventory contains duplicate geonameid values")

    decisions_by_id: dict[str, dict[str, str]] = {}
    status_counts = {status: 0 for status in sorted(ALLOWED_DECISION_STATUSES)}
    phase_counts = {
        phase: {status: 0 for status in sorted(ALLOWED_DECISION_STATUSES)}
        for phase in ("cities15000", "cities5000", "cities1000", "cities500")
    }
    for row_number, row in enumerate(decisions, start=2):
        geonames_id = row.get("geonameid", "")
        label = f"{snapshot / 'decisions' / 'CN.csv'}:{row_number}"
        if geonames_id in decisions_by_id:
            errors.append(f"{label}: duplicate decision for geonameid {geonames_id}")
            continue
        decisions_by_id[geonames_id] = row
        if geonames_id not in inventory:
            errors.append(f"{label}: geonameid is not present in CN inventory")
            continue
        status = row.get("status", "")
        if status not in ALLOWED_DECISION_STATUSES:
            errors.append(f"{label}: invalid completed status {status!r}")
            continue
        status_counts[status] += 1
        phase_counts[inventory[geonames_id]["assigned_phase"]][status] += 1
        for key in ("reviewed_by", "reviewed_at", "quality_gate_version"):
            if not row.get(key):
                errors.append(f"{label}: missing {key}")
        if row.get("reviewed_at"):
            parse_iso_date(row["reviewed_at"], label, errors)

        if status == "researched":
            raw_page_path = row.get("page_path", "")
            page_path = repository / Path(raw_page_path)
            if not raw_page_path or not page_path.is_file():
                errors.append(f"{label}: researched page does not exist: {raw_page_path!r}")
            else:
                page = city_pages.get(geonames_id)
                if page is None or page[0].resolve() != page_path.resolve():
                    errors.append(f"{label}: page front matter does not match geonameid/path")
        if status in AUDIT_STATUSES:
            for key in ("reason_code", "reason", "evidence_url"):
                if not row.get(key):
                    errors.append(f"{label}: {status} decision is missing {key}")
        if status in MERGE_STATUSES and not (
            row.get("canonical_geonameid") or row.get("canonical_page_path")
        ):
            errors.append(f"{label}: {status} decision lacks a canonical target")

    for geonames_id, (path, front_matter) in city_pages.items():
        if front_matter.get("country_code") == "CN":
            if geonames_id not in inventory:
                errors.append(f"{path}: researched CN page is outside the fixed inventory")
            decision = decisions_by_id.get(geonames_id)
            if not decision or decision.get("status") != "researched":
                errors.append(f"{path}: researched CN page lacks a researched decision row")

    legal_city_coverage = validate_legal_city_ledger(
        repository, legal_snapshot_date, city_pages, errors
    )
    processed = sum(status_counts.values())
    return {
        "schema_version": 1,
        "snapshot_date": snapshot_date,
        "inventory_count": len(inventory),
        "decision_count": len(decisions_by_id),
        "processed_count": processed,
        "unprocessed_count": len(inventory) - processed,
        "completion_fraction": processed / len(inventory) if inventory else 0.0,
        "status_counts": status_counts,
        "phase_status_counts": phase_counts,
        "researched_page_count_all_countries": len(city_pages),
        "legal_city_coverage": legal_city_coverage,
        "errors": errors,
    }


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--snapshot-date", default="2026-07-30")
    parser.add_argument("--legal-snapshot-date", default="2025-12-31")
    parser.add_argument("--json", action="store_true", help="print the complete report as JSON")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = validate_repository(
            args.repository.resolve(), args.snapshot_date, args.legal_snapshot_date
        )
    except (OSError, ValidationFailure) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(
            f"CN coverage: {report['processed_count']}/{report['inventory_count']} processed; "
            f"researched pages across all countries: {report['researched_page_count_all_countries']}"
        )
        legal = report["legal_city_coverage"]
        if legal["available"]:
            print(
                f"CN legal cities: {legal['researched_count']}/"
                f"{legal['inventory_count']} researched"
            )
        for error in report["errors"]:
            print(f"error: {error}", file=sys.stderr)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
