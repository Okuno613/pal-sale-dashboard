import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deadlineTime, filterDeals, mergeDeals } from '../public/deals.js';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const feed = JSON.parse(readFileSync(new URL('../data/seen.json', import.meta.url), 'utf8'));

test('published catalogue has unique identities, usable metadata and public source URLs', () => {
  for (const key of ['id', 'name']) {
    assert.equal(new Set(catalog.map(deal => deal[key])).size, catalog.length, `duplicate ${key}`);
  }
  for (const deal of catalog) {
    for (const key of ['id', 'name', 'group', 'field', 'offerType', 'campaignType', 'benefit', 'description', 'conditions', 'serviceSummary', 'checkedAt']) {
      assert.ok(typeof deal[key] === 'string' && deal[key].trim(), `${deal.id}: missing ${key}`);
    }
    for (const key of ['url', 'serviceUrl']) {
      const url = new URL(deal[key]);
      assert.ok(['https:', 'http:'].includes(url.protocol), `${deal.id}: unsafe ${key}`);
      assert.ok(!url.username && !url.password, `${deal.id}: credentials in ${key}`);
      assert.ok(!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), `${deal.id}: local ${key}`);
    }
    assert.ok(deal.discount === null || (Number.isFinite(deal.discount) && deal.discount >= 0 && deal.discount <= 100), `${deal.id}: invalid discount`);
    assert.ok(deal.deadline === null || deadlineTime(deal.deadline) !== null, `${deal.id}: invalid deadline`);
    assert.ok(Number.isFinite(Date.parse(deal.checkedAt)), `${deal.id}: invalid check date`);
  }
});

test('real feed preserves curated offers and numeric filters exclude non-discount rewards', () => {
  const merged = mergeDeals(feed.seen, catalog);
  for (const deal of catalog) {
    assert.ok(merged.some(item => item.id === deal.id), `feed lost ${deal.id}`);
  }
  const nonDiscounts = catalog.filter(deal => deal.discount === null);
  const discounted = filterDeals(catalog, { minDiscount: 1 });
  assert.ok(discounted.length > 0);
  assert.ok(nonDiscounts.length > 0);
  assert.ok(discounted.every(deal => !nonDiscounts.some(other => other.id === deal.id)));
});
