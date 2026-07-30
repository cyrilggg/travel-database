import csv
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "scripts"))

from build_cn_inventory import BuildError, DATASETS, build_inventory  # noqa: E402


def geonames_row(geonameid: int, name: str, country: str = "CN") -> bytes:
    fields = [
        str(geonameid),
        name,
        name,
        "",
        "31.2",
        "121.5",
        "P",
        "PPL",
        country,
        "",
        "01",
        "",
        "",
        "",
        "1000",
        "",
        "",
        "Asia/Shanghai" if country == "CN" else "Europe/Paris",
        "2026-07-30",
    ]
    return ("\t".join(fields) + "\n").encode("utf-8")


class BuildCnInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def write_inputs(self, membership, use_zip=True):
        inputs = {}
        for dataset in DATASETS:
            content = b"".join(
                geonames_row(geonameid, f"City {geonameid}")
                for geonameid in membership[dataset]
            ) + geonames_row(9000, "Paris", "FR")
            if use_zip:
                path = self.root / f"{dataset}.zip"
                with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
                    archive.writestr(f"{dataset}.txt", content)
            else:
                path = self.root / f"{dataset}.txt"
                path.write_bytes(content)
            inputs[dataset] = path
        return inputs

    def test_builds_flags_assigned_phase_hashes_and_counts(self):
        membership = {
            "cities15000": [1],
            "cities5000": [1, 2],
            "cities1000": [1, 2, 3],
            "cities500": [1, 2, 3, 4],
        }
        inputs = self.write_inputs(membership)
        checks = {}
        for dataset, path in inputs.items():
            checks[dataset] = {
                "file_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "row_count": len(membership[dataset]) + 1,
                "distinct_geonameid_count": len(membership[dataset]) + 1,
                "cn_row_count": len(membership[dataset]),
            }
        checks_path = self.root / "checks.json"
        checks_path.write_text(json.dumps(checks), encoding="utf-8")
        output = self.root / "inventory" / "CN.csv"
        report_path = self.root / "report.json"

        report = build_inventory(inputs, output, report_path, checks_path)

        self.assertTrue(report["checks"]["passed"])
        self.assertTrue(report["hierarchy"]["is_strictly_nested"])
        self.assertEqual(
            report["hierarchy"]["pairwise"]["cities15000_vs_cities500"],
            {"intersection_count": 1, "left_only_count": 0, "right_only_count": 3},
        )
        self.assertEqual(report["inventory"]["row_count"], 4)
        with output.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual([row["geonameid"] for row in rows], ["1", "2", "3", "4"])
        self.assertEqual(
            [row["assigned_phase"] for row in rows],
            ["cities15000", "cities5000", "cities1000", "cities500"],
        )
        self.assertEqual(rows[1]["in_cities15000"], "false")
        self.assertEqual(rows[1]["in_cities5000"], "true")
        self.assertEqual(json.loads(report_path.read_text(encoding="utf-8")), report)

    def test_reports_non_nested_membership_without_losing_record(self):
        membership = {
            "cities15000": [1],
            "cities5000": [],
            "cities1000": [],
            "cities500": [],
        }
        inputs = self.write_inputs(membership, use_zip=False)
        output = self.root / "CN.csv"
        report_path = self.root / "report.json"

        report = build_inventory(inputs, output, report_path)

        self.assertFalse(report["hierarchy"]["is_strictly_nested"])
        violation = report["hierarchy"]["violations"]["cities15000_not_in_cities5000"]
        self.assertEqual(violation, {"count": 1, "geonameids": ["1"]})
        with output.open(encoding="utf-8", newline="") as handle:
            self.assertEqual(next(csv.DictReader(handle))["geonameid"], "1")

    def test_strict_hierarchy_and_bad_hash_fail_before_output(self):
        membership = {
            "cities15000": [1],
            "cities5000": [],
            "cities1000": [],
            "cities500": [],
        }
        inputs = self.write_inputs(membership)
        output = self.root / "CN.csv"
        report_path = self.root / "report.json"
        with self.assertRaisesRegex(BuildError, "not strictly nested"):
            build_inventory(inputs, output, report_path, strict_hierarchy=True)
        self.assertFalse(output.exists())
        self.assertFalse(report_path.exists())

        checks = {
            dataset: {"file_sha256": "0" * 64, "row_count": len(membership[dataset]) + 1}
            for dataset in DATASETS
        }
        checks_path = self.root / "checks.json"
        checks_path.write_text(json.dumps(checks), encoding="utf-8")
        with self.assertRaisesRegex(BuildError, "source verification failed"):
            build_inventory(inputs, output, report_path, checks_path)
        self.assertFalse(output.exists())

    def test_refuses_to_overwrite_an_input(self):
        membership = {dataset: [1] for dataset in DATASETS}
        inputs = self.write_inputs(membership, use_zip=False)
        with self.assertRaisesRegex(BuildError, "refusing to overwrite"):
            build_inventory(inputs, inputs["cities500"], self.root / "report.json")


if __name__ == "__main__":
    unittest.main()
