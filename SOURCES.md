# Candidate sources for the public feed

This file lists external sites and datasets that agents may use to **find candidates** for
`data/seen.json`. It is a research aid, not a source of truth. The rules in
[README.md](README.md) still apply: publish public deal facts only, verify on the official page,
and never carry over an unconfirmed number, deadline or eligibility claim.

Last checked: **2026-11-25**.

## How to use these sources

1. Use a source to discover a candidate, then open the provider's official page.
2. Confirm the offer terms, the eligible plans, the deadline and the signup requirements there.
3. Confirm that a person in Japan can actually sign up and use it. If that cannot be confirmed,
   do not publish the item; keep it out of `data/seen.json` and note it as held.
4. Record the official URL and the date checked. Do not copy a source site's estimated value,
   "approval odds" or countdown as fact.
5. Do not add affiliate, referral or personalised URLs. Do not submit signups or payments.

Japan availability is the deciding filter for this feed. A source that says "global" or omits
country data is **not** evidence that the offer works from Japan.

## Sources

| Source | URL | What it covers | Cadence | Japan availability | Use and caveat |
| --- | --- | --- | --- | --- | --- |
| AI Resource Radar | <https://ai-resource-radar.github.io/ai-resource-radar/> | Free AI APIs, GPU compute, grants, token and GPU prices | Daily | Not recorded (0 of 139 items list `JP`, 2026-11-25) | Best structural match. Use its public JSON as candidate input, then verify Japan access yourself. MIT licensed; local dashboard is macOS/Linux, Windows untested. |
| AI Credits | <https://aicredits.tech/> | Free credits, student benefits, startup programmes, coupons | Weekly | Not recorded | Hand-checked editorial list with conditions and a proprietary "Approval Index". Useful for US/student/startup offers; the index is the site's own score, not a guarantee. Ads and partner placements are present. |
| Find AI Credits | <https://findaicredits.com/> | Same categories as AI Credits | Weekly | Not recorded | Nearly the same layout and wording as AI Credits. Treat it as a second view, not an independent confirmation. |
| Resource.fyi — Black Friday | <https://resource.fyi/black-friday-deals> | AI, SaaS, developer tools and app discounts | Live during the season | Not recorded | 173 live deals at the last check. Shows codes and end dates and removes ended deals. Broader than AI; many entries are not relevant to this feed. |
| 模真真 — 每日领羊毛 | <https://mozhenzhen.com/wool> | Daily and monthly free quotas, mostly Chinese providers | Daily | Not recorded | 98 offers with a per-offer check date. Strong on Chinese free tiers; require a Chinese phone, real-name verification or mainland account for many entries. |
| Free AI Bible | <https://github.com/abbosaliboev/free-ai-bible> | Free APIs, local models, tools and starters | Periodic | Not recorded | 72 resources with a searchable directory and CSV/JSON export. MIT. A directory, not a daily watch; limits may be stale. |
| free-ai-resources-x | <https://github.com/CelaDaniel/free-ai-resources-x> | Curated free AI tools, APIs and datasets | Periodic | Not recorded | Large curated list (about 1k stars). Good for breadth; no freshness guarantee per entry. |
| cc-deal-hunter | <https://github.com/cc6pzupa/cc-deal-hunter> | Agent workflow to find, verify, deduplicate and claim deals | Periodic | Not recorded | Closest to an agent workflow rather than a catalogue. Licence is reported as `NOASSERTION`; review before reuse. Auto-claim steps must not be run for this feed. |
| Get AI Perks | <https://www.getaiperks.com/en> | Startup and partner perks, 300+ offers | Daily/weekly claim | Not recorded | Paid subscription service. Mostly startup eligibility, not recurring free tiers. Useful only as a lead source for company-stage offers. |

Japanese articles that compare API pricing or free tiers (for example Shift AI, SIGNATE and
Business Insider) are useful background, but they are not maintained trackers. Do not treat an
article's table as a current offer without checking the provider page.

## AI Resource Radar data

Public endpoints:

- <https://ai-resource-radar.github.io/ai-resource-radar/data/resources.json>
- <https://ai-resource-radar.github.io/ai-resource-radar/data/changes.json>
- <https://ai-resource-radar.github.io/ai-resource-radar/data/providers.json>
- <https://ai-resource-radar.github.io/ai-resource-radar/data/manifest.json>

Fields worth reading:

- `offer_id` — stable id for change tracking.
- `verification_level` — `official_api`, `official_page` or `community`. Prefer the first two.
- `availability.supported_countries` — country list. At the last check the data was effectively
  China-centric and contained no `JP`.
- `availability.scope` — `unknown` for 134 of 139 items, `restricted` for 5.
- `requires_card`, `requires_phone`, `eligibility`, `quota_value`, `quota_unit`, `reset_period`.
- `first_seen_at`, `last_changed_at` — use these to find recent additions or changes.
- `presentations.en` / `presentations.zh-CN` — display text; Japanese is not provided.

The radar contains many per-model rows that share a title and URL. Deduplicate by
provider + title + action URL before treating a row as a separate offer.

## What this file is not

- Not a list of approved offers. Every item still needs the official check.
- Not a place for account details, referral codes, private notes or agent-specific instructions.
- Not a substitute for the public feed schema in [README.md](README.md).

When you add a source, include its URL, what it covers, how often it changes, any Japan evidence
you found (with the date), and a one-line caveat. Keep the table alphabetical or append new rows;
do not remove a source without a reason in the commit message.
