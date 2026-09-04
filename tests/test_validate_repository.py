import csv
from pathlib import Path
import sys
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "scripts"))

from validate_repository import REQUIRED_HEADINGS, validate_repository  # noqa: E402


DECISION_FIELDS = (
    "geonameid",
    "status",
    "page_path",
    "canonical_geonameid",
    "canonical_page_path",
    "reason_code",
    "reason",
    "evidence_url",
    "reviewed_by",
    "reviewed_at",
    "quality_gate_version",
)


class ValidateRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.city_dir = self.root / "destinations" / "中国" / "测试省"
        self.city_dir.mkdir(parents=True)
        self.city_path = self.city_dir / "测试市.md"
        headings = "\n\n".join(f"## {heading}\n\n有效内容。" for heading in REQUIRED_HEADINGS)
        self.city_path.write_text(
            "---\n"
            "schema_version: 1\n"
            'title: "测试市旅行指南"\n'
            'country: "中国"\n'
            'country_code: "CN"\n'
            'admin_area: "测试省"\n'
            'city: "测试市"\n'
            "geonames_id: 1\n"
            'wikidata_id: "Q1"\n'
            "last_researched: 2026-07-30\n"
            "content_status: researched\n"
            "languages:\n  - zh-CN\n"
            "---\n\n"
            "# 测试市旅行指南\n\n"
            "公开旅行资料。\n\n"
            f"{headings}\n",
            encoding="utf-8",
        )
        (self.city_dir / "README.md").write_text(
            "# 测试省\n\n[测试市](./测试市.md)\n", encoding="utf-8"
        )
        snapshot = self.root / "coverage" / "geonames" / "2026-07-30"
        (snapshot / "inventory").mkdir(parents=True, exist_ok=True)
        (snapshot / "decisions").mkdir(parents=True, exist_ok=True)
        with (snapshot / "inventory" / "CN.csv").open(
            "w", encoding="utf-8", newline=""
        ) as handle:
            writer = csv.DictWriter(handle, fieldnames=("geonameid", "assigned_phase"))
            writer.writeheader()
            writer.writerow({"geonameid": "1", "assigned_phase": "cities15000"})
        self.decisions_path = snapshot / "decisions" / "CN.csv"

    def tearDown(self):
        self.temporary.cleanup()

    def write_decisions(self, rows):
        with self.decisions_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=DECISION_FIELDS)
            writer.writeheader()
            writer.writerows(rows)

    def write_legal_city_ledger(self, *, city_name="测试市", geonameid="1"):
        snapshot = self.root / "coverage" / "legal-cities" / "2025-12-31"
        (snapshot / "inventory").mkdir(parents=True, exist_ok=True)
        (snapshot / "decisions").mkdir(parents=True, exist_ok=True)
        with (snapshot / "inventory" / "CN-legal-cities.csv").open(
            "w", encoding="utf-8", newline=""
        ) as handle:
            fields = (
                "administrative_code",
                "name",
                "city_level",
                "source_cutoff",
            )
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerow(
                {
                    "administrative_code": "990100",
                    "name": city_name,
                    "city_level": "prefecture_level_city",
                    "source_cutoff": "2025-12-31",
                }
            )
        with (snapshot / "decisions" / "CN.csv").open(
            "w", encoding="utf-8", newline=""
        ) as handle:
            fields = (
                "administrative_code",
                "status",
                "page_path",
                "geonameid",
                "reviewed_by",
                "reviewed_at",
                "quality_gate_version",
            )
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerow(
                {
                    "administrative_code": "990100",
                    "status": "researched",
                    "page_path": "destinations/中国/测试省/测试市.md",
                    "geonameid": geonameid,
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            )

    def test_accepts_researched_page_matching_sparse_ledger(self):
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": "destinations/中国/测试省/测试市.md",
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertEqual(report["errors"], [])
        self.assertEqual(report["processed_count"], 1)
        self.assertEqual(report["status_counts"]["researched"], 1)

    def test_validates_independent_legal_city_ledger(self):
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": "destinations/中国/测试省/测试市.md",
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )
        self.write_legal_city_ledger()

        report = validate_repository(self.root, "2026-07-30")

        self.assertEqual(report["errors"], [])
        self.assertEqual(report["legal_city_coverage"]["inventory_count"], 1)
        self.assertEqual(report["legal_city_coverage"]["researched_count"], 1)

        self.write_legal_city_ledger(city_name="另一个市")
        report = validate_repository(self.root, "2026-07-30")
        self.assertTrue(any("does not match legal-city name" in item for item in report["errors"]))

    def test_researched_page_without_decision_is_not_complete(self):
        self.write_decisions([])

        report = validate_repository(self.root, "2026-07-30")

        self.assertTrue(any("lacks a researched decision" in item for item in report["errors"]))
        self.assertEqual(report["processed_count"], 0)

    def test_accepts_legal_city_only_page_outside_geonames_snapshot(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original.replace(
                "geonames_id: 1\n",
                "geonames_id: 2\ncoverage_scope: legal_city_only\nlegal_admin_code: 990100\n",
            ),
            encoding="utf-8",
        )
        self.write_decisions([])
        self.write_legal_city_ledger(geonameid="2")

        report = validate_repository(self.root, "2026-07-30")

        self.assertEqual(report["errors"], [])
        self.assertEqual(report["processed_count"], 0)
        self.assertEqual(report["legal_city_coverage"]["researched_count"], 1)

    def test_legal_city_only_page_requires_matching_legal_decision(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original.replace(
                "geonames_id: 1\n",
                "geonames_id: 2\ncoverage_scope: legal_city_only\nlegal_admin_code: 990100\n",
            ),
            encoding="utf-8",
        )
        self.write_decisions([])
        self.write_legal_city_ledger(geonameid="1")

        report = validate_repository(self.root, "2026-07-30")

        self.assertTrue(
            any("lacks a matching legal-city decision" in item for item in report["errors"])
        )

    def test_rejects_mojibake_in_china_navigation_markdown(self):
        (self.city_dir / "README.md").write_text(
            "# å±±ä¸œçœæ—…è¡Œç›®çš„åœ°\n", encoding="utf-8"
        )
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": "destinations/中国/测试省/测试市.md",
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertTrue(any("likely UTF-8 mojibake" in item for item in report["errors"]))

    def test_rejects_unexpected_city_h2(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original + "\n## 使用方法\n\n不应出现的工作流章节。\n", encoding="utf-8"
        )
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": "destinations/中国/测试省/测试市.md",
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertTrue(any("unexpected H2 headings" in item for item in report["errors"]))

    def test_rejects_table_row_with_wrong_column_count_and_reports_location(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original + "\n| first | second |\n| --- | --- |\n| only one |\n",
            encoding="utf-8",
        )
        bad_line = self.city_path.read_text(encoding="utf-8").splitlines().index(
            "| only one |"
        ) + 1
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": self.city_path.relative_to(self.root).as_posix(),
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        relative_path = self.city_path.relative_to(self.root).as_posix()
        self.assertTrue(
            any(
                item.startswith(f"{relative_path}:{bad_line}: table row has 1 columns")
                for item in report["errors"]
            )
        )

    def test_table_column_count_ignores_escaped_pipes(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original
            + "\n| first | second |\n"
            + "| --- | --- |\n"
            + "| bus \\| ferry | valid cell |\n",
            encoding="utf-8",
        )
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": self.city_path.relative_to(self.root).as_posix(),
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertEqual(report["errors"], [])

    def test_table_detection_ignores_plain_pipe_text_and_fenced_examples(self):
        original = self.city_path.read_text(encoding="utf-8")
        self.city_path.write_text(
            original
            + "\nThis A | B expression is prose, not a table.\n"
            + "| This looks | table-like |\n"
            + "but | this is not a delimiter row\n"
            + "\n```markdown\n"
            + "| first | second |\n"
            + "| --- | --- |\n"
            + "| only one |\n"
            + "```\n",
            encoding="utf-8",
        )
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "researched",
                    "page_path": self.city_path.relative_to(self.root).as_posix(),
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertEqual(report["errors"], [])

    def test_audit_decision_requires_reason_evidence_and_target(self):
        self.city_path.unlink()
        self.write_decisions(
            [
                {
                    "geonameid": "1",
                    "status": "merged",
                    "reviewed_by": "reviewer",
                    "reviewed_at": "2026-07-30",
                    "quality_gate_version": "1",
                }
            ]
        )

        report = validate_repository(self.root, "2026-07-30")

        self.assertTrue(any("merged decision is missing reason" in item for item in report["errors"]))
        self.assertTrue(any("lacks a canonical target" in item for item in report["errors"]))


if __name__ == "__main__":
    unittest.main()
