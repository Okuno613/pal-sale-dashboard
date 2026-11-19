# PAL セールノート

Japanese read-only sale dashboard: filters for 系統, 分野, offer type, discount and deadlines; four sorts; on-device bookmarks and shareable filter URLs. No purchase, signup, account or payment submission paths.

## Run

Python 3.10+ builds the static site without packages. Node.js 20+ is only needed for checks/tests.

```sh
npm run build
npm start
# http://localhost:3000
npm run check
npm test
```

## Independent hosting and feed

GitHub Pages serves `dist/` independently of Devin sessions. The Pages workflow checks the code, builds and deploys on each push to `main`. PRs run checks without deploying. This repository stays private; the deployed catalogue is public, approved by PAL on SO's behalf. Only public deal information is included, not SO's memory, profile or preferences.

Each sale-watch run, after research succeeds and `seen.json` is saved/synced:

1. Clone this repo or update its clean `main` checkout (`git pull --ff-only`).
2. Run `python3 publish_feed.py --source ~/memory/pal_aea0b2/files/sale-watch/seen.json`.
3. Review `git diff -- data/seen.json`: **public deal details only**, no personal data, credentials, referral/personalized URLs or account details. The allowlist removes unknown keys but cannot determine whether free text is private; the watcher must check it.
4. `git add data/seen.json && git commit -m "Refresh public sale feed" && git push origin main`.

This tiny data-only commit is the only ongoing publishing task. The workflow rebuilds Pages automatically; do not wake a managing session, open recurring data PRs, run a second crawler or add a new automation. `checked_at` records each successful watch, including no-new-deal runs. Never publish a timestamp for a failed watch.

The dashboard fetches the generated JSON once a minute, on tab return and manually. A warning appears when the last successful watch is over 24 hours old; failed reloads retain the current view. A browser can't bypass Pages CDN propagation: allow the GitHub Actions deployment and its cache to settle, usually a few minutes.

## Source schema and semantics

`data/catalog.json` contains curated Japanese metadata from PAL's 2026-11-19 reports and conversation. These inherited claims are not independently re-verified by this app. Prices, eligibility and regional availability must be checked at the source. No login, purchase or signup was performed to build this app.

`data/seen.json` uses `{ "checked_at": "ISO timestamp", "seen": [{ "name": "Public deal name", "url": "https://...", "deadline": "2026-11-30" }] }`. `publish_feed.py` allowlists these keys and optional `titleJa`, `group`, `field`, `offerType`, `benefit`, `description`, `conditions`, `discount` (0–100), `starts`, `checkedAt`. Unknown fields are dropped. Do not put private text into allowed fields.

New deals appear as 新着・未整理 with 未分類 filters until optional public metadata is provided. Unknown discounts/deadlines stay unknown. Bonus credits and points aren't silently converted into discounts. Date-only deadlines mean end of day JST and are labelled as time-unconfirmed. Exact timestamps include their UTC offset. Curated precise deadlines override lossy date-only feed values (Qwen crosses midnight in JST); explicit timestamps in the feed can update them. Curated offers stay in the archive even if absent from the latest feed; expired deals automatically leave the default view.

There are no runtime dependencies, backend, remote fonts, analytics or service worker. Bookmarks remain in browser-local storage. All displayed source text uses textContent; source links allow HTTP(S) only. Relative asset and data URLs support both a project Pages path and a root domain.
