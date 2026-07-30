import csv
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "scripts"))

from build_cn_legal_city_inventory import (  # noqa: E402
    API_URL,
    LegalCityError,
    VERSION_PAGE_URL,
    build_inventory,
    parse_cutoff,
)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class BuildCnLegalCityInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.raw = self.root / "raw"
        self.raw.mkdir()
        self.provinces = (("11", "北京市"), ("13", "河北省"))

    def tearDown(self):
        self.temporary.cleanup()

    def write_sources(self):
        page = "<p>数据截止日期为2025年12月31日。</p>".encode("utf-8")
        (self.raw / "version-page.html").write_bytes(page)
        responses = {
            "11": {
                "data": {
                    "code": "11",
                    "name": "北京市",
                    "level": 1,
                    "type": "直辖市",
                    "children": [
                        {
                            "code": "110101",
                            "name": "东城区",
                            "level": 3,
                            "type": "市辖区",
                            "children": [],
                        }
                    ],
                },
                "status": 200,
            },
            "13": {
                "data": {
                    "code": "13",
                    "name": "河北省",
                    "level": 1,
                    "type": "省",
                    "children": [
                        {
                            "code": "1301",
                            "name": "石家庄市",
                            "level": 2,
                            "type": "地级市",
                            "children": [
                                {
                                    "code": "130181",
                                    "name": "辛集市",
                                    "level": 3,
                                    "type": "县级市",
                                    "children": [],
                                }
                            ],
                        },
                        {
                            "code": "139001",
                            "name": "示例直管市",
                            "level": 3,
                            "type": "县级市",
                            "children": [],
                        },
                    ],
                },
                "status": 200,
            },
        }
        entries = []
        for code, name in self.provinces:
            payload = json.dumps(
                responses[code], ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            archive = gzip.compress(payload, mtime=0)
            filename = f"{code}.json.gz"
            (self.raw / filename).write_bytes(archive)
            entries.append(
                {
                    "province_code": code,
                    "province_name": name,
                    "url": API_URL.format(code=code),
                    "filename": filename,
                    "payload_sha256": digest(payload),
                    "archive_sha256": digest(archive),
                }
            )
        manifest = {
            "schema_version": 1,
            "source_cutoff": "2025-12-31",
            "retrieved_at_utc": "2026-07-30T00:00:00Z",
            "version_page": {
                "url": VERSION_PAGE_URL,
                "filename": "version-page.html",
                "sha256": digest(page),
            },
            "province_sources": entries,
        }
        (self.raw / "source-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
        )

    def test_extracts_three_legal_city_levels_and_parent(self):
        self.write_sources()
        output = self.root / "inventory" / "CN-legal-cities.csv"
        report_path = self.root / "report.json"
        report = build_inventory(
            self.raw,
            output,
            report_path,
            "2025-12-31",
            provinces=self.provinces,
        )

        self.assertEqual(report["inventory"]["row_count"], 4)
        self.assertEqual(
            report["inventory"]["counts_by_city_level"],
            {
                "direct_municipality": 1,
                "prefecture_level_city": 1,
                "county_level_city": 2,
            },
        )
        with output.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(
            [row["administrative_code"] for row in rows],
            ["110000", "130100", "130181", "139001"],
        )
        self.assertEqual(rows[2]["prefecture_administrative_code"], "130100")
        self.assertEqual(rows[3]["prefecture_administrative_code"], "")
        self.assertEqual(
            json.loads(report_path.read_text(encoding="utf-8")), report
        )

    def test_detects_changed_archive_and_cutoff(self):
        self.write_sources()
        archive = self.raw / "13.json.gz"
        archive.write_bytes(archive.read_bytes() + b"changed")
        with self.assertRaisesRegex(LegalCityError, "archive hash mismatch"):
            build_inventory(
                self.raw,
                self.root / "CN.csv",
                self.root / "report.json",
                "2025-12-31",
                provinces=self.provinces,
            )
        self.assertEqual(
            parse_cutoff("数据截止日期为 2025 年 12 月 31 日".encode("utf-8")),
            "2025-12-31",
        )
        with self.assertRaisesRegex(LegalCityError, "does not state"):
            parse_cutoff(b"no cutoff")


if __name__ == "__main__":
    unittest.main()
