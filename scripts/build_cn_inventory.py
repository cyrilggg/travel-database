#!/usr/bin/env python3
"""Build an auditable China inventory from four local GeoNames city dumps.

This program deliberately has no network access and never creates destination
pages.  It accepts GeoNames ``cities*.txt`` files or the corresponding ZIP
archives, records their hashes and counts, and writes one unique CN inventory.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
from typing import BinaryIO, Iterable, Mapping
import zipfile


DATASETS = ("cities15000", "cities5000", "cities1000", "cities500")
OUTPUT_FIELDS = (
    "geonameid",
    "name",
    "asciiname",
    "country_code",
    "admin1_code",
    "admin2_code",
    "admin3_code",
    "admin4_code",
    "feature_class",
    "feature_code",
    "population",
    "latitude",
    "longitude",
    "timezone",
    "geonames_modified_at",
    "in_cities15000",
    "in_cities5000",
    "in_cities1000",
    "in_cities500",
    "assigned_phase",
)


class BuildError(RuntimeError):
    """Raised when an input cannot safely produce an auditable inventory."""


def sha256_stream(stream: BinaryIO) -> str:
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


def sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        return sha256_stream(stream)


def _open_text_source(path: Path, dataset: str):
    """Return a binary context manager and the logical inner filename."""
    if zipfile.is_zipfile(path):
        archive = zipfile.ZipFile(path)
        expected = f"{dataset}.txt"
        matches = [name for name in archive.namelist() if Path(name).name == expected]
        if len(matches) != 1:
            archive.close()
            raise BuildError(
                f"{path.name}: expected exactly one {expected!r} member; "
                f"found {len(matches)}"
            )
        member = matches[0]
        return archive, archive.open(member, "r"), member, "zip"
    return None, path.open("rb"), path.name, "text"


def _record_from_columns(columns: list[str], path: Path, line_number: int) -> dict[str, str]:
    if len(columns) != 19:
        raise BuildError(
            f"{path.name}:{line_number}: expected 19 tab-separated fields, "
            f"found {len(columns)}"
        )
    if not columns[0].isdigit():
        raise BuildError(f"{path.name}:{line_number}: invalid geonameid {columns[0]!r}")
    if columns[14] and not columns[14].isdigit():
        raise BuildError(f"{path.name}:{line_number}: invalid population {columns[14]!r}")
    return {
        "geonameid": columns[0],
        "name": columns[1],
        "asciiname": columns[2],
        "country_code": columns[8],
        "admin1_code": columns[10],
        "admin2_code": columns[11],
        "admin3_code": columns[12],
        "admin4_code": columns[13],
        "feature_class": columns[6],
        "feature_code": columns[7],
        "population": columns[14],
        "latitude": columns[4],
        "longitude": columns[5],
        "timezone": columns[17],
        "geonames_modified_at": columns[18],
    }


def read_dataset(path: Path, dataset: str) -> tuple[dict[str, dict[str, str]], dict[str, object]]:
    if not path.is_file():
        raise BuildError(f"input does not exist or is not a file: {path}")

    file_sha256 = sha256_file(path)
    owner, binary, inner_filename, input_type = _open_text_source(path, dataset)
    try:
        inner_digest = hashlib.sha256()
        row_count = 0
        seen_ids: set[str] = set()
        duplicate_ids: set[str] = set()
        cn_records: dict[str, dict[str, str]] = {}
        for line_number, raw_line in enumerate(binary, start=1):
            inner_digest.update(raw_line)
            line = raw_line.decode("utf-8-sig").rstrip("\r\n")
            if not line:
                continue
            row_count += 1
            columns = line.split("\t")
            record = _record_from_columns(columns, path, line_number)
            geonameid = record["geonameid"]
            if geonameid in seen_ids:
                duplicate_ids.add(geonameid)
            else:
                seen_ids.add(geonameid)
            if record["country_code"] == "CN":
                previous = cn_records.get(geonameid)
                if previous is not None and previous != record:
                    raise BuildError(
                        f"{path.name}: conflicting duplicate CN record for geonameid {geonameid}"
                    )
                cn_records[geonameid] = record
    except UnicodeDecodeError as exc:
        raise BuildError(f"{path.name}: input is not valid UTF-8: {exc}") from exc
    finally:
        binary.close()
        if owner is not None:
            owner.close()

    if duplicate_ids:
        sample = ", ".join(sorted(duplicate_ids, key=int)[:10])
        raise BuildError(
            f"{path.name}: duplicate geonameid values are not allowed "
            f"({len(duplicate_ids)} found; sample: {sample})"
        )

    stats: dict[str, object] = {
        "source_filename": path.name,
        "input_type": input_type,
        "file_sha256": file_sha256,
        "inner_filename": inner_filename,
        "inner_sha256": inner_digest.hexdigest(),
        "row_count": row_count,
        "distinct_geonameid_count": len(seen_ids),
        "duplicate_geonameid_count": 0,
        "cn_row_count": len(cn_records),
    }
    return cn_records, stats


def load_checks(path: Path | None) -> dict[str, dict[str, object]] | None:
    if path is None:
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuildError(f"cannot read checks file {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise BuildError("checks file must contain a JSON object")
    missing = [name for name in DATASETS if name not in value]
    if missing:
        raise BuildError(f"checks file is missing datasets: {', '.join(missing)}")
    for dataset in DATASETS:
        check = value[dataset]
        if not isinstance(check, dict):
            raise BuildError(f"checks entry {dataset!r} must be an object")
        for required in ("file_sha256", "row_count"):
            if required not in check:
                raise BuildError(f"checks entry {dataset!r} is missing {required!r}")
    return value


def verify_checks(
    checks: Mapping[str, Mapping[str, object]] | None,
    source_stats: Mapping[str, Mapping[str, object]],
) -> bool | None:
    if checks is None:
        return None
    allowed = {
        "file_sha256",
        "inner_sha256",
        "row_count",
        "distinct_geonameid_count",
        "duplicate_geonameid_count",
        "cn_row_count",
    }
    mismatches: list[str] = []
    for dataset in DATASETS:
        for key, expected in checks[dataset].items():
            if key not in allowed:
                raise BuildError(f"checks entry {dataset!r} has unsupported field {key!r}")
            actual = source_stats[dataset][key]
            if key.endswith("sha256"):
                equal = str(expected).lower() == str(actual).lower()
            else:
                equal = expected == actual
            if not equal:
                mismatches.append(f"{dataset}.{key}: expected {expected!r}, got {actual!r}")
    if mismatches:
        raise BuildError("source verification failed:\n  " + "\n  ".join(mismatches))
    return True


def hierarchy_report(memberships: Mapping[str, set[str]]) -> dict[str, object]:
    violations: dict[str, dict[str, object]] = {}
    for narrower, broader in zip(DATASETS, DATASETS[1:]):
        ids = sorted(memberships[narrower] - memberships[broader], key=int)
        key = f"{narrower}_not_in_{broader}"
        violations[key] = {"count": len(ids), "geonameids": ids}

    first_three = set().union(*(memberships[name] for name in DATASETS[:3]))
    outside_final = sorted(first_three - memberships["cities500"], key=int)
    violations["earlier_phases_not_in_cities500"] = {
        "count": len(outside_final),
        "geonameids": outside_final,
    }
    pairwise: dict[str, dict[str, int]] = {}
    for index, left in enumerate(DATASETS):
        for right in DATASETS[index + 1 :]:
            pairwise[f"{left}_vs_{right}"] = {
                "intersection_count": len(memberships[left] & memberships[right]),
                "left_only_count": len(memberships[left] - memberships[right]),
                "right_only_count": len(memberships[right] - memberships[left]),
            }
    return {
        "expected_order": list(DATASETS),
        "is_strictly_nested": not any(item["count"] for item in violations.values()),
        "pairwise": pairwise,
        "violations": violations,
    }


def _write_csv_atomic(path: Path, rows: Iterable[Mapping[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", delete=False, dir=path.parent
    )
    temporary = Path(handle.name)
    try:
        with handle:
            writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _write_json_atomic(path: Path, value: Mapping[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="\n", delete=False, dir=path.parent
    )
    temporary = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def build_inventory(
    inputs: Mapping[str, Path],
    output_path: Path,
    report_path: Path,
    checks_path: Path | None = None,
    strict_hierarchy: bool = False,
) -> dict[str, object]:
    input_paths = {path.resolve() for path in inputs.values()}
    protected_paths = input_paths | ({checks_path.resolve()} if checks_path is not None else set())
    if output_path.resolve() == report_path.resolve():
        raise BuildError("output CSV and JSON report must use different paths")
    for destination in (output_path, report_path):
        if destination.resolve() in protected_paths:
            raise BuildError(f"refusing to overwrite input or checks file: {destination}")

    records_by_dataset: dict[str, dict[str, dict[str, str]]] = {}
    source_stats: dict[str, dict[str, object]] = {}
    for dataset in DATASETS:
        records, stats = read_dataset(inputs[dataset], dataset)
        records_by_dataset[dataset] = records
        source_stats[dataset] = stats

    checks = load_checks(checks_path)
    checks_passed = verify_checks(checks, source_stats)
    memberships = {name: set(records_by_dataset[name]) for name in DATASETS}
    hierarchy = hierarchy_report(memberships)
    if strict_hierarchy and not hierarchy["is_strictly_nested"]:
        raise BuildError("CN memberships are not strictly nested; see non-strict report output")

    all_ids = set().union(*memberships.values())
    rows: list[dict[str, str]] = []
    for geonameid in sorted(all_ids, key=int):
        available = [name for name in DATASETS if geonameid in records_by_dataset[name]]
        reference = records_by_dataset[available[0]][geonameid]
        for dataset in available[1:]:
            candidate = records_by_dataset[dataset][geonameid]
            if candidate != reference:
                raise BuildError(
                    f"geonameid {geonameid} differs between {available[0]} and {dataset}; "
                    "the four inputs may not be from one consistent snapshot"
                )
        row = dict(reference)
        for dataset in DATASETS:
            row[f"in_{dataset}"] = "true" if geonameid in memberships[dataset] else "false"
        row["assigned_phase"] = available[0]
        rows.append(row)

    report: dict[str, object] = {
        "schema_version": 1,
        "country_code": "CN",
        "sources": source_stats,
        "checks": {
            "checks_filename": checks_path.name if checks_path is not None else None,
            "passed": checks_passed,
        },
        "hierarchy": hierarchy,
        "inventory": {
            "filename": output_path.name,
            "row_count": len(rows),
            "distinct_geonameid_count": len(all_ids),
        },
    }
    _write_csv_atomic(output_path, rows)
    _write_json_atomic(report_path, report)
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    for dataset in DATASETS:
        parser.add_argument(
            f"--{dataset}", required=True, type=Path, help=f"local {dataset}.zip or .txt"
        )
    parser.add_argument("--output", required=True, type=Path, help="output CN.csv path")
    parser.add_argument("--report", required=True, type=Path, help="output JSON report path")
    parser.add_argument(
        "--checks",
        type=Path,
        help="optional JSON with expected file_sha256 and row_count for every input",
    )
    parser.add_argument(
        "--strict-hierarchy",
        action="store_true",
        help="fail instead of reporting when the four CN memberships are not nested",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    inputs = {dataset: getattr(args, dataset) for dataset in DATASETS}
    try:
        report = build_inventory(
            inputs=inputs,
            output_path=args.output,
            report_path=args.report,
            checks_path=args.checks,
            strict_hierarchy=args.strict_hierarchy,
        )
    except BuildError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(
        f"wrote {report['inventory']['row_count']} CN records to {args.output}; "
        f"hierarchy nested: {str(report['hierarchy']['is_strictly_nested']).lower()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
