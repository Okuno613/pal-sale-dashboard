"""Build a portable static dashboard; GitHub Pages serves it without a session."""
import json
import shutil
from pathlib import Path
from publish_feed import sanitize

ROOT = Path(__file__).resolve().parent


def build(root=ROOT):
    feed = sanitize(json.loads((root / 'data/seen.json').read_text(encoding='utf-8')))
    payload = {'seen': feed['seen'], 'checkedAt': feed['checked_at'], 'syncedAt': None,
               'sourceAvailable': True,
               'catalog': json.loads((root / 'data/catalog.json').read_text(encoding='utf-8'))}
    output = root / 'dist'
    output.mkdir(exist_ok=True)
    shutil.copytree(root / 'public', output, dirs_exist_ok=True)
    (output / 'deals.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    (output / '.nojekyll').touch()
    return output


if __name__ == '__main__':
    print(build())
