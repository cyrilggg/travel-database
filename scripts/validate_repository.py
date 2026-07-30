#!/usr/bin/env python3
"""Validate researched city guides and the sparse China coverage ledger."""

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
DIALOGUE_HEADING = re.compile(r"^#{2,3}\s+(?:先|怎样|怎么|是否|适不适合)")
FRONT_MATTER_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$")
LOCAL_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


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
        if heading not in headings:
            errors.append(f"{path}: missing required heading '## {heading}'")
            continue
        positions.append(headings.index(heading))
    if len(positions) == len(REQUIRED_HEADINGS) and positions != sorted(positions):
        errors.append(f"{path}: required headings are out of order")


def validate_copy(path: Path, text: str, errors: list[str]) -> None:
    for phrase in BANNED_PHRASES:
        if phrase in text:
            errors.append(f"{path}: contains banned personalized/workflow phrase {phrase!r}")
    for line_number, line in enumerate(text.splitlines(), start=1):
        if DIALOGUE_HEADING.match(line):
            errors.append(f"{path}:{line_number}: dialogue-style heading {line!r}")
    for pattern in PLACEHOLDER_PATTERNS:
        if pattern.search(text):
            errors.append(f"{path}: contains placeholder matching {pattern.pattern!r}")


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


def validate_repository(repository: Path, snapshot_date: str) -> dict[str, object]:
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
        validate_copy(path, text, errors)
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
        "errors": errors,
    }


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--snapshot-date", default="2026-07-30")
    parser.add_argument("--json", action="store_true", help="print the complete report as JSON")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = validate_repository(args.repository.resolve(), args.snapshot_date)
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
        for error in report["errors"]:
            print(f"error: {error}", file=sys.stderr)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
