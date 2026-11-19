"""Copy public deal fields only; never publish the complete memory folder."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC_FIELDS = ('name', 'url', 'deadline', 'titleJa', 'group', 'field', 'offerType',
                 'benefit', 'description', 'conditions', 'discount', 'starts', 'checkedAt',
                 'serviceSummary', 'serviceUrl', 'campaignType')


def sanitize(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get('seen'), list):
        raise ValueError('Expected an object with a seen array')
    seen = []
    for record in raw['seen']:
        if not isinstance(record, dict) or not isinstance(record.get('name'), str):
            raise ValueError('Every deal must have a public name')
        url = urlsplit(record.get('url', ''))
        if url.scheme not in ('https', 'http') or not url.netloc or url.username or url.password:
            raise ValueError('Every deal must have a public HTTP(S) source URL')
        # Basic source schema is intentionally tiny; unknown fields never pass through.
        clean = {key: record[key] for key in PUBLIC_FIELDS if key in record}
        for key, value in clean.items():
            if key == 'serviceUrl' and value is not None:
                if not isinstance(value, str):
                    raise ValueError('Service source must be text')
                source = urlsplit(value)
                if source.scheme not in ('https', 'http') or not source.netloc or source.username or source.password:
                    raise ValueError('Service source must be a public HTTP(S) URL')
            if key == 'discount':
                if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 100):
                    raise ValueError('Discount must be 0–100 or null')
            elif value is not None and not isinstance(value, str):
                raise ValueError(f'{key} must be text or null')
        seen.append(clean)
    return {'seen': seen, 'checked_at': raw.get('checked_at') or raw.get('updated_at')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/seen.json')
    args = parser.parse_args()
    payload = sanitize(json.loads(args.source.expanduser().read_text(encoding='utf-8')))
    # Invoking this after a successful watch records the actual check, even with no new deals.
    payload['checked_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Prepared {len(payload['seen'])} public deals")
