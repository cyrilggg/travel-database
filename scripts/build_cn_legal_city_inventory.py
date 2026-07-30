#!/usr/bin/env python3
"""Fetch and build an auditable mainland-China legal-city inventory.

The source is the Ministry of Civil Affairs administrative-division code
service.  ``fetch`` fixes the published version page and one response for each
of the 31 mainland provincial-level divisions.  ``build`` works offline from
those saved responses and extracts municipalities, prefecture-level cities,
and county-level cities without treating other prefecture-level divisions as
cities.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timezone
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from typing import Iterable, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


VERSION_PAGE_URL = "https://dmfw.mca.gov.cn/XzqhVersionPublish.html"
API_URL = "https://dmfw.mca.gov.cn/xzqh/getList?code={code}&trimCode=true&maxLevel=3"
PROVINCES = (
    ("11", "北京市"),
    ("12", "天津市"),
    ("13", "河北省"),
    ("14", "山西省"),
    ("15", "内蒙古自治区"),
    ("21", "辽宁省"),
    ("22", "吉林省"),
    ("23", "黑龙江省"),
    ("31", "上海市"),
    ("32", "江苏省"),
    ("33", "浙江省"),
    ("34", "安徽省"),
    ("35", "福建省"),
    ("36", "江西省"),
    ("37", "山东省"),
    ("41", "河南省"),
    ("42", "湖北省"),
    ("43", "湖南省"),
    ("44", "广东省"),
    ("45", "广西壮族自治区"),
    ("46", "海南省"),
    ("50", "重庆市"),
    ("51", "四川省"),
    ("52", "贵州省"),
    ("53", "云南省"),
    ("54", "西藏自治区"),
    ("61", "陕西省"),
    ("62", "甘肃省"),
    ("63", "青海省"),
    ("64", "宁夏回族自治区"),
    ("65", "新疆维吾尔自治区"),
)
CITY_TYPES = {
    "直辖市": "direct_municipality",
    "地级市": "prefecture_level_city",
    "县级市": "county_level_city",
}
OUTPUT_FIELDS = (
    "administrative_code",
    "name",
    "city_level",
    "source_type",
    "province_administrative_code",
    "province_name",
    "prefecture_administrative_code",
    "prefecture_name",
    "source_cutoff",
    "source_url",
)
_CUTOFF_RE = re.compile(
    r"数据截止日期为\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日"
)


class LegalCityError(RuntimeError):
    """Raised when sources cannot produce a trustworthy fixed inventory."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def parse_cutoff(page: bytes) -> str:
    try:
        text = page.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise LegalCityError(f"version page is not valid UTF-8: {exc}") from exc
    match = _CUTOFF_RE.search(text)
    if match is None:
        raise LegalCityError("version page does not state an administrative-data cutoff")
    try:
        cutoff = date(*(int(part) for part in match.groups()))
    except ValueError as exc:
        raise LegalCityError(f"version page contains an invalid cutoff: {exc}") from exc
    return cutoff.isoformat()


def _request_bytes(url: str, *, referer: str | None, timeout: float, attempts: int) -> bytes:
    headers = {
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        "User-Agent": "travel-database snapshot builder/1 (+https://github.com/cyrilggg/travel-database)",
    }
    if referer is not None:
        headers["Referer"] = referer
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urlopen(Request(url, headers=headers), timeout=timeout) as response:
                if response.status != 200:
                    raise LegalCityError(f"{url}: unexpected HTTP status {response.status}")
                return response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(min(2**attempt, 4))
    raise LegalCityError(f"cannot retrieve {url}: {last_error}")


def _parse_response(payload: bytes, expected_code: str, expected_name: str) -> Mapping[str, object]:
    try:
        response = json.loads(payload.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LegalCityError(f"province {expected_code}: invalid JSON response: {exc}") from exc
    if not isinstance(response, dict) or response.get("status") != 200:
        raise LegalCityError(f"province {expected_code}: response status is not 200")
    data = response.get("data")
    if not isinstance(data, dict):
        raise LegalCityError(f"province {expected_code}: response data is not an object")
    if str(data.get("code")) != expected_code or data.get("name") != expected_name:
        raise LegalCityError(
            f"province {expected_code}: expected {expected_name!r}, got "
            f"code={data.get('code')!r}, name={data.get('name')!r}"
        )
    return response


def _gzip_deterministic(payload: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(filename="", fileobj=buffer, mode="wb", mtime=0) as archive:
        archive.write(payload)
    return buffer.getvalue()


def fetch_sources(
    output_dir: Path,
    expected_cutoff: str,
    *,
    provinces: Sequence[tuple[str, str]] = PROVINCES,
    timeout: float = 30,
    attempts: int = 3,
) -> dict[str, object]:
    if output_dir.exists():
        raise LegalCityError(f"refusing to overwrite existing source directory: {output_dir}")
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.", dir=output_dir.parent))
    try:
        version_page = _request_bytes(
            VERSION_PAGE_URL, referer=None, timeout=timeout, attempts=attempts
        )
        actual_cutoff = parse_cutoff(version_page)
        if actual_cutoff != expected_cutoff:
            raise LegalCityError(
                f"source cutoff is {actual_cutoff}, expected {expected_cutoff}; "
                "use a new snapshot directory for a new source version"
            )
        page_path = temporary / "version-page.html"
        page_path.write_bytes(version_page)

        source_entries: list[dict[str, object]] = []
        for code, name in provinces:
            url = API_URL.format(code=code)
            payload = _request_bytes(
                url, referer=VERSION_PAGE_URL, timeout=timeout, attempts=attempts
            )
            _parse_response(payload, code, name)
            compressed = _gzip_deterministic(payload)
            filename = f"{code}.json.gz"
            (temporary / filename).write_bytes(compressed)
            source_entries.append(
                {
                    "province_code": code,
                    "province_name": name,
                    "url": url,
                    "filename": filename,
                    "payload_size_bytes": len(payload),
                    "payload_sha256": sha256_bytes(payload),
                    "archive_size_bytes": len(compressed),
                    "archive_sha256": sha256_bytes(compressed),
                }
            )

        manifest: dict[str, object] = {
            "schema_version": 1,
            "source_name": "中华人民共和国民政部行政区划代码",
            "source_cutoff": actual_cutoff,
            "retrieved_at_utc": datetime.now(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            "scope": "31 mainland provincial-level divisions; HK, MO and TW not requested",
            "version_page": {
                "url": VERSION_PAGE_URL,
                "filename": page_path.name,
                "size_bytes": len(version_page),
                "sha256": sha256_bytes(version_page),
            },
            "province_sources": source_entries,
        }
        (temporary / "source-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temporary, output_dir)
        return manifest
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def _canonical_code(value: object, expected_length: int) -> str:
    code = str(value)
    if not code.isdigit() or len(code) > expected_length:
        raise LegalCityError(f"invalid administrative code {value!r}")
    return code.ljust(expected_length, "0")


def _walk_nodes(node: Mapping[str, object], ancestors=()):
    yield node, ancestors
    children = node.get("children", [])
    if children is None:
        children = []
    if not isinstance(children, list):
        raise LegalCityError(f"node {node.get('code')!r} has non-list children")
    for child in children:
        if not isinstance(child, dict):
            raise LegalCityError(f"node {node.get('code')!r} has a non-object child")
        yield from _walk_nodes(child, ancestors + (node,))


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
    raw_dir: Path,
    output_path: Path,
    report_path: Path,
    expected_cutoff: str,
    *,
    provinces: Sequence[tuple[str, str]] = PROVINCES,
) -> dict[str, object]:
    manifest_path = raw_dir / "source-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LegalCityError(f"cannot read source manifest {manifest_path}: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        raise LegalCityError("source manifest must use schema_version 1")
    if manifest.get("source_cutoff") != expected_cutoff:
        raise LegalCityError(
            f"manifest cutoff is {manifest.get('source_cutoff')!r}, expected {expected_cutoff!r}"
        )

    page = manifest.get("version_page")
    if not isinstance(page, dict):
        raise LegalCityError("source manifest is missing version_page")
    if page.get("url") != VERSION_PAGE_URL:
        raise LegalCityError("source manifest version-page URL does not match the official source")
    if page.get("filename") != "version-page.html":
        raise LegalCityError("source manifest version-page filename is not canonical")
    page_path = raw_dir / "version-page.html"
    try:
        page_bytes = page_path.read_bytes()
    except OSError as exc:
        raise LegalCityError(f"cannot read fixed version page {page_path}: {exc}") from exc
    if sha256_bytes(page_bytes) != page.get("sha256"):
        raise LegalCityError("fixed version-page hash does not match the manifest")
    if parse_cutoff(page_bytes) != expected_cutoff:
        raise LegalCityError("fixed version-page cutoff does not match the requested snapshot")

    entries = manifest.get("province_sources")
    if not isinstance(entries, list):
        raise LegalCityError("source manifest is missing province_sources")
    by_code = {
        str(entry.get("province_code")): entry
        for entry in entries
        if isinstance(entry, dict)
    }
    expected_codes = {code for code, _ in provinces}
    if set(by_code) != expected_codes or len(entries) != len(provinces):
        raise LegalCityError("source manifest does not contain exactly the expected provinces")

    rows: list[dict[str, str]] = []
    seen_codes: set[str] = set()
    node_type_counts: dict[str, int] = {}
    province_counts: dict[str, int] = {}
    total_nodes = 0
    for province_code, province_name in provinces:
        entry = by_code[province_code]
        if entry.get("province_name") != province_name:
            raise LegalCityError(f"province {province_code}: manifest name mismatch")
        expected_url = API_URL.format(code=province_code)
        expected_filename = f"{province_code}.json.gz"
        if entry.get("url") != expected_url:
            raise LegalCityError(f"province {province_code}: manifest URL mismatch")
        if entry.get("filename") != expected_filename:
            raise LegalCityError(f"province {province_code}: manifest filename mismatch")
        archive_path = raw_dir / expected_filename
        try:
            archive_bytes = archive_path.read_bytes()
        except OSError as exc:
            raise LegalCityError(f"cannot read province archive {archive_path}: {exc}") from exc
        if sha256_bytes(archive_bytes) != entry.get("archive_sha256"):
            raise LegalCityError(f"province {province_code}: archive hash mismatch")
        try:
            payload = gzip.decompress(archive_bytes)
        except (OSError, EOFError) as exc:
            raise LegalCityError(f"province {province_code}: invalid gzip archive: {exc}") from exc
        if sha256_bytes(payload) != entry.get("payload_sha256"):
            raise LegalCityError(f"province {province_code}: payload hash mismatch")
        response = _parse_response(payload, province_code, province_name)
        root = response["data"]
        assert isinstance(root, dict)
        province_full_code = _canonical_code(province_code, 6)
        source_url = str(entry.get("url"))
        for node, ancestors in _walk_nodes(root):
            total_nodes += 1
            source_type = str(node.get("type", ""))
            node_type_counts[source_type] = node_type_counts.get(source_type, 0) + 1
            city_level = CITY_TYPES.get(source_type)
            if city_level is None:
                continue
            level = node.get("level")
            expected_level = {
                "direct_municipality": 1,
                "prefecture_level_city": 2,
                "county_level_city": 3,
            }[city_level]
            if level != expected_level:
                raise LegalCityError(
                    f"province {province_code}: {source_type} node has unexpected level {level!r}"
                )
            administrative_code = _canonical_code(node.get("code"), 6)
            name = str(node.get("name", "")).strip()
            if not name:
                raise LegalCityError(
                    f"province {province_code}: city {administrative_code} has no name"
                )
            if not administrative_code.startswith(province_code):
                raise LegalCityError(
                    f"province {province_code}: city code {administrative_code} crosses province"
                )
            if administrative_code in seen_codes:
                raise LegalCityError(f"duplicate city administrative code {administrative_code}")
            seen_codes.add(administrative_code)
            prefecture = next(
                (
                    ancestor
                    for ancestor in reversed(ancestors)
                    if ancestor.get("level") == 2
                ),
                None,
            )
            rows.append(
                {
                    "administrative_code": administrative_code,
                    "name": name,
                    "city_level": city_level,
                    "source_type": source_type,
                    "province_administrative_code": province_full_code,
                    "province_name": province_name,
                    "prefecture_administrative_code": (
                        _canonical_code(prefecture.get("code"), 6)
                        if prefecture is not None
                        else ""
                    ),
                    "prefecture_name": str(prefecture.get("name", "")) if prefecture else "",
                    "source_cutoff": expected_cutoff,
                    "source_url": source_url,
                }
            )
            province_counts[province_name] = province_counts.get(province_name, 0) + 1

    rows.sort(key=lambda row: row["administrative_code"])
    level_counts = {
        level: sum(row["city_level"] == level for row in rows)
        for level in CITY_TYPES.values()
    }
    _write_csv_atomic(output_path, rows)
    report: dict[str, object] = {
        "schema_version": 1,
        "scope": "mainland China legal cities",
        "source_cutoff": expected_cutoff,
        "source_version_page_url": page.get("url", VERSION_PAGE_URL),
        "source_manifest": str(manifest_path.as_posix()),
        "source_retrieved_at_utc": manifest.get("retrieved_at_utc"),
        "province_source_count": len(provinces),
        "total_source_node_count": total_nodes,
        "source_node_type_counts": dict(sorted(node_type_counts.items())),
        "inventory": {
            "filename": output_path.name,
            "row_count": len(rows),
            "sha256": sha256_bytes(output_path.read_bytes()),
            "counts_by_city_level": level_counts,
            "counts_by_province": province_counts,
        },
    }
    _write_json_atomic(report_path, report)
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    fetch = commands.add_parser("fetch", help="fix official source responses locally")
    fetch.add_argument("--output-dir", required=True, type=Path)
    fetch.add_argument("--expected-cutoff", required=True)
    fetch.add_argument("--timeout-seconds", type=float, default=30)
    fetch.add_argument("--attempts", type=int, default=3)
    build = commands.add_parser("build", help="build an inventory from fixed responses")
    build.add_argument("--raw-dir", required=True, type=Path)
    build.add_argument("--output", required=True, type=Path)
    build.add_argument("--report", required=True, type=Path)
    build.add_argument("--expected-cutoff", required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.command == "fetch":
            manifest = fetch_sources(
                args.output_dir,
                args.expected_cutoff,
                timeout=args.timeout_seconds,
                attempts=args.attempts,
            )
            print(
                f"fixed {len(manifest['province_sources'])} province responses "
                f"with cutoff {manifest['source_cutoff']} in {args.output_dir}"
            )
        else:
            report = build_inventory(
                args.raw_dir, args.output, args.report, args.expected_cutoff
            )
            counts = report["inventory"]["counts_by_city_level"]
            print(
                f"wrote {report['inventory']['row_count']} legal cities to {args.output} "
                f"({counts['direct_municipality']} municipalities, "
                f"{counts['prefecture_level_city']} prefecture-level cities, "
                f"{counts['county_level_city']} county-level cities)"
            )
    except LegalCityError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
