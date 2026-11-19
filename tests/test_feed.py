import json
import tempfile
import unittest
from pathlib import Path
from build import build
from publish_feed import sanitize


class FeedTests(unittest.TestCase):
    def test_only_public_allowlisted_fields_are_published(self):
        raw = {'seen': [{'name': 'Sale', 'url': 'https://example.com/sale', 'deadline': None,
                         'private_note': 'must not be exposed', 'account': 'must not be exposed'}],
               'owner': 'must not be exposed', 'checked_at': '2026-11-19T20:00:00+09:00'}
        clean = sanitize(raw)
        self.assertEqual(set(clean), {'seen', 'checked_at'})
        self.assertEqual(set(clean['seen'][0]), {'name', 'url', 'deadline'})

    def test_bad_source_schema_and_private_credentials_are_rejected(self):
        for raw in [{}, {'seen': {}}, {'seen': [3]},
                    {'seen': [{'name': 'X', 'url': 'javascript:alert(1)'}]},
                    {'seen': [{'name': 'X', 'url': 'https://user:secret@example.com'}]},
                    {'seen': [{'name': 'X', 'url': 'https://example.com', 'discount': 200}]}]:
            with self.assertRaises(ValueError):
                sanitize(raw)

    def test_static_build_rereads_new_feed_without_any_running_session(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'public').mkdir()
            (root / 'public/index.html').write_text('<html lang="ja"></html>')
            (root / 'data/catalog.json').write_text('[]')
            source = root / 'data/seen.json'
            source.write_text(json.dumps({'seen': [{'name': 'A', 'url': 'https://example.com/a'}]}))
            output = build(root)
            self.assertEqual(len(json.loads((output / 'deals.json').read_text())['seen']), 1)
            source.write_text(json.dumps({'seen': [{'name': 'A', 'url': 'https://example.com/a'}, {'name': 'B', 'url': 'https://example.com/b'}]}))
            build(root)
            self.assertEqual(len(json.loads((output / 'deals.json').read_text())['seen']), 2)

    def test_official_context_is_allowed_but_unsafe_service_sources_are_rejected(self):
        record = {'name': 'Sale', 'url': 'https://example.com/sale',
                  'serviceSummary': 'AI development tool', 'serviceUrl': 'https://example.com/',
                  'campaignType': 'Launch offer'}
        self.assertEqual(sanitize({'seen': [record]})['seen'][0], record)
        for source in ['javascript:alert(1)', 'https://user:secret@example.com/']:
            with self.assertRaises(ValueError):
                sanitize({'seen': [{**record, 'serviceUrl': source}]})

    def test_catalog_has_unique_ids_and_no_bonus_as_discount(self):
        catalog = json.loads((Path(__file__).resolve().parents[1] / 'data/catalog.json').read_text())
        self.assertEqual(len(catalog), len({d['id'] for d in catalog}))
        for deal in catalog:
            self.assertTrue(deal['url'].startswith('https://'))
            if deal['offerType'] == 'チャージ増量':
                self.assertIsNone(deal['discount'])
