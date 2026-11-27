"""Small CLI so a watch bot can manage the public feed without reading whole JSON files.

  python -X utf8 deals.py list [--all] [--catalog]  one line per feed deal (live only by default)
  python -X utf8 deals.py show <text>           full records whose name/title contains text
  python -X utf8 deals.py upsert <file|->       add or update records by name (JSON object or array)
  python -X utf8 deals.py prune [--days 14]     move feed deals ended N+ days ago to data/archive.json
  python -X utf8 deals.py publish -m <message>  stamp checked_at, test, build, commit feed, push, verify Pages
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from publish_feed import sanitize

ROOT = Path(__file__).resolve().parent
SEEN = ROOT / 'data/seen.json'
CATALOG = ROOT / 'data/catalog.json'
ARCHIVE = ROOT / 'data/archive.json'
JST = timezone(timedelta(hours=9))
PAGES_FEED = 'https://okuno613.github.io/pal-sale-dashboard/deals.json'


def read(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def end_date(deadline):
    """Deadline as a JST calendar date; date-only values mean the end of that day in Japan."""
    if not deadline:
        return None
    try:
        if len(deadline) == 10:
            return date.fromisoformat(deadline)
        return datetime.fromisoformat(deadline.replace('Z', '+00:00')).astimezone(JST).date()
    except ValueError:
        return None


def today():
    return datetime.now(JST).date()


def cmd_list(args):
    feed, catalog = read(SEEN, {'seen': []}), read(CATALOG, [])
    linked = {c.get('feedName') for c in catalog} | {c.get('name') for c in catalog}
    rows = [('feed', d['name'], d.get('deadline'), d.get('checkedAt'), d['name'] in linked) for d in feed['seen']]
    if args.catalog:
        rows += [('catalog', c['id'], c.get('deadline'), c.get('checkedAt'), False) for c in catalog]
    shown = 0
    for source, key, deadline, checked, _ in sorted(rows, key=lambda r: (r[2] or '9999', r[1])):
        end = end_date(deadline)
        if not args.all and end is not None and end < today():
            continue
        print(f'{source}\t{key}\t{deadline or "-"}\tchecked {checked or "-"}')
        shown += 1
    print(f'# {shown} shown / feed {len(feed["seen"])} / catalog {len(catalog)} / checked_at {feed.get("checked_at")}')


def cmd_show(args):
    needle = args.text.lower()
    for label, records in (('feed', read(SEEN, {'seen': []})['seen']), ('catalog', read(CATALOG, []))):
        for d in records:
            keys = [d.get('name', ''), d.get('titleJa', ''), d.get('id', ''), d.get('feedName', '')]
            if any(needle in (k or '').lower() for k in keys):
                print(f'## {label}\n{json.dumps(d, ensure_ascii=False, indent=1)}')


def upsert(records, feed, checked=None):
    """Merge records into the feed by name. Given keys overwrite; missing keys are kept."""
    added, updated = [], []
    index = {d['name']: d for d in feed['seen']}
    for record in records:
        record = {**record}
        record.setdefault('checkedAt', checked or today().isoformat())
        if record['name'] in index:
            index[record['name']].update(record)
            updated.append(record['name'])
        else:
            feed['seen'].append(record)
            index[record['name']] = record
            added.append(record['name'])
    sanitize(feed)  # Reject unsafe URLs or bad fields before anything is written.
    return added, updated


def cmd_upsert(args):
    text = sys.stdin.read() if args.file == '-' else Path(args.file).read_text(encoding='utf-8')
    data = json.loads(text)
    records = data if isinstance(data, list) else [data]
    feed = read(SEEN, {'seen': []})
    added, updated = upsert(records, feed)
    write(SEEN, feed)
    print(f'added {len(added)}: {", ".join(added) or "-"}\nupdated {len(updated)}: {", ".join(updated) or "-"}')


def prune(feed, archive, days, catalog=(), now=None):
    """Move feed-only deals that ended at least `days` ago.

    Records linked to a curated catalog entry stay: they may override its deadline,
    and removing them could make an ended catalog offer look live again."""
    limit = (now or today()) - timedelta(days=days)
    linked = {c.get('feedName') for c in catalog} | {c.get('name') for c in catalog}
    keep, moved = [], []
    for d in feed['seen']:
        end = end_date(d.get('deadline'))
        (moved if end is not None and end < limit and d['name'] not in linked else keep).append(d)
    feed['seen'] = keep
    archive.extend(moved)
    return moved


def cmd_prune(args):
    feed, archive = read(SEEN, {'seen': []}), read(ARCHIVE, [])
    moved = prune(feed, archive, args.days, read(CATALOG, []))
    write(SEEN, feed)
    write(ARCHIVE, archive)
    print(f'archived {len(moved)}: {", ".join(d["name"] for d in moved) or "-"}')


def run(*command):
    print('$', ' '.join(command), flush=True)
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, encoding='utf-8')
    if result.returncode:
        print(result.stdout[-3000:], result.stderr[-3000:], sep='\n')
        raise SystemExit(f'FAILED: {" ".join(command)}')
    return result.stdout.strip()


def cmd_publish(args):
    feed = sanitize(read(SEEN, {'seen': []}))
    feed['checked_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    write(SEEN, feed)
    py, node = sys.executable, 'node'
    run(py, '-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'tests')
    run(node, '--test', *[str(p.relative_to(ROOT)) for p in sorted((ROOT / 'tests').glob('*.test.mjs'))])
    run(py, '-X', 'utf8', 'build.py')
    run('git', 'add', 'data/seen.json', *(['data/archive.json'] if ARCHIVE.exists() else []))
    if not run('git', 'diff', '--cached', '--name-only'):
        raise SystemExit('Nothing to commit')
    run('git', 'commit', '-m', args.message)
    run('git', 'pull', '--rebase', 'origin', 'main')
    run('git', 'push', 'origin', 'HEAD:main')
    sha = run('git', 'rev-parse', 'HEAD')
    print(f'pushed {sha[:7]}; waiting for Pages…', flush=True)
    if args.no_verify:
        return
    deadline = time.time() + 600
    while time.time() < deadline:
        time.sleep(20)
        try:
            with urllib.request.urlopen(f'{PAGES_FEED}?t={int(time.time())}', timeout=20) as response:
                live = json.load(response)
        except OSError:
            continue
        if live.get('checkedAt') == feed['checked_at']:
            print(f'PUBLISHED: {len(live["seen"])} feed deals, checkedAt {live["checkedAt"]}')
            return
    raise SystemExit(f'NOT VERIFIED: Pages did not show checkedAt {feed["checked_at"]} within 10 minutes; check GitHub Actions')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('list'); p.add_argument('--all', action='store_true')
    p.add_argument('--catalog', action='store_true'); p.set_defaults(func=cmd_list)
    p = sub.add_parser('show'); p.add_argument('text'); p.set_defaults(func=cmd_show)
    p = sub.add_parser('upsert'); p.add_argument('file'); p.set_defaults(func=cmd_upsert)
    p = sub.add_parser('prune'); p.add_argument('--days', type=int, default=14); p.set_defaults(func=cmd_prune)
    p = sub.add_parser('publish'); p.add_argument('-m', '--message', default='Refresh public sale feed')
    p.add_argument('--no-verify', action='store_true'); p.set_defaults(func=cmd_publish)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == '__main__':
    main()
