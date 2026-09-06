import csv
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from validate_repository import validate_taiwan_ledger

class TaiwanLedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.center = self.root / 'site/data/tw-city-centers.csv'
        self.center.parent.mkdir(parents=True)
        self.center.write_text('administrative_code,name,geonames_id\n63000,台北市,1668341\n', encoding='utf-8')
        self.ledger = self.root / 'coverage/CN/taiwan-2026-09-06/decisions.csv'
        self.ledger.parent.mkdir(parents=True)
        self.row = dict(candidate_id='tw:63000', display_name='台北市', country_code='CN',
                        guide_id='cn-1668341', source_path='destinations/中国/台湾省/台北市.md',
                        status='researched', target_guide_id='', reason='首访入口', evidence='site/data/tw-city-centers.csv', updated_at='2026-09-06')
        self.pages = {'1668341': (self.root / self.row['source_path'],
                     dict(coverage_scope='taiwan_batch', country_code='CN', city='台北市'))}

    def validate(self, rows=None):
        with self.ledger.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=self.row.keys())
            writer.writeheader()
            writer.writerows([self.row] if rows is None else rows)
        errors = []
        result = validate_taiwan_ledger(self.root, self.pages, errors)
        return result, errors

    def test_valid_batch_preserves_stable_identity(self):
        result, errors = self.validate()
        self.assertEqual(errors, [])
        self.assertEqual(result['researched_ids'], ['1668341'])

    def test_rejects_wrong_guide_identity(self):
        self.row['guide_id'] = 'cn-1'
        result, errors = self.validate()
        self.assertEqual(result['researched_ids'], [])
        self.assertTrue(any('mismatch' in error for error in errors))

    def test_rejects_unaccounted_inventory(self):
        _, errors = self.validate([])
        self.assertTrue(any('all existing city centers' in error for error in errors))

    def test_deferred_does_not_count_as_researched(self):
        self.row.update(status='deferred', guide_id='', source_path='')
        result, errors = self.validate()
        self.assertEqual(errors, [])
        self.assertEqual(result['researched_count'], 0)

    def test_deferred_cannot_claim_guide(self):
        self.row['status'] = 'deferred'
        _, errors = self.validate()
        self.assertTrue(any('must not claim' in error for error in errors))

    def test_rejects_unknown_candidate_and_duplicate(self):
        _, errors = self.validate([self.row, self.row])
        self.assertTrue(any('duplicate' in error for error in errors))
        self.row['candidate_id'] = 'tw:99999'
        _, errors = self.validate()
        self.assertTrue(any('not in existing' in error for error in errors))

if __name__ == '__main__':
    unittest.main()
