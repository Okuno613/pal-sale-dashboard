import unittest
from datetime import date

from deals import end_date, prune, upsert


class DealsCliTests(unittest.TestCase):
    def test_upsert_adds_new_and_patches_existing_by_name(self):
        feed = {'seen': [{'name': 'A', 'url': 'https://example.com/a', 'discount': 50, 'benefit': '50% OFF'}]}
        added, updated = upsert([{'name': 'A', 'url': 'https://example.com/a', 'discount': None},
                                 {'name': 'B', 'url': 'https://example.com/b'}], feed, checked='2026-11-28')
        self.assertEqual((added, updated), (['B'], ['A']))
        self.assertIsNone(feed['seen'][0]['discount'])
        self.assertEqual(feed['seen'][0]['benefit'], '50% OFF')
        self.assertEqual(feed['seen'][1]['checkedAt'], '2026-11-28')

    def test_upsert_rejects_unsafe_records(self):
        with self.assertRaises(ValueError):
            upsert([{'name': 'X', 'url': 'javascript:alert(1)'}], {'seen': []})

    def test_prune_keeps_live_undated_and_catalog_linked_deals(self):
        feed = {'seen': [{'name': 'old', 'deadline': '2026-11-01'}, {'name': 'linked', 'deadline': '2026-11-01'},
                         {'name': 'recent', 'deadline': '2026-11-20'}, {'name': 'open', 'deadline': None}]}
        archive = []
        moved = prune(feed, archive, 14, catalog=[{'feedName': 'linked'}], now=date(2026, 11, 28))
        self.assertEqual([d['name'] for d in moved], ['old'])
        self.assertEqual([d['name'] for d in feed['seen']], ['linked', 'recent', 'open'])
        self.assertEqual(archive, moved)

    def test_end_date_uses_japan_calendar(self):
        self.assertEqual(end_date('2026-11-30T23:59:00+08:00'), date(2026, 12, 1))
        self.assertEqual(end_date('2026-11-30'), date(2026, 11, 30))
        self.assertIsNone(end_date('soon'))
