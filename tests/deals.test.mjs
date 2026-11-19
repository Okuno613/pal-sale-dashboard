import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDeals, filterDeals, sortDeals, statusOf, deadlineTime, daysLeft, safeUrl } from '../public/deals.js';
const now = Date.parse('2026-11-19T20:00:00+09:00');
test('date-only deadlines last through the Japanese calendar day', () => {
  const deal = { deadline: '2026-11-19' };
  assert.equal(statusOf(deal, Date.parse('2026-11-19T23:59:00+09:00')), 'active');
  assert.equal(statusOf(deal, Date.parse('2026-11-20T00:00:00+09:00')), 'ended');
  assert.equal(daysLeft(deal, now), 0);
  assert.equal(deadlineTime('not a date'), null);
});
test('planned offers and cross-timezone deadlines are preserved', () => {
  assert.equal(statusOf({ starts: '2026-11-20T00:00:00+09:00' }, now), 'upcoming');
  assert.equal(deadlineTime('2026-11-30T23:59:00+08:00'), Date.parse('2026-12-01T00:59:00+09:00'));
});
test('new feed records appear without editing code and unsafe links are rejected', () => {
  const result = mergeDeals([{ name: '<script>sale</script>', url: 'javascript:alert(1)', deadline: null }], []);
  assert.equal(result.length, 1); assert.equal(result[0].name, '<script>sale</script>');
  assert.equal(result[0].group, '未分類'); assert.equal(result[0].url, null);
  assert.equal(safeUrl('https://example.com/sale'), 'https://example.com/sale');
});
test('precise deadlines survive date-only feed values; explicit updates still apply', () => {
  const catalog = [{ id: 'qwen', feedName: 'Qwen', deadline: '2026-12-01T00:59:00+09:00', preciseDeadline: true }];
  let result = mergeDeals([{ name: 'Qwen', deadline: '2026-11-30', discount: 40 }], catalog);
  assert.equal(result.length, 1); assert.equal(result[0].deadline, catalog[0].deadline); assert.equal(result[0].discount, 40);
  result = mergeDeals([{ name: 'Qwen', deadline: '2026-12-02T00:00:00+09:00' }], catalog);
  assert.equal(result[0].deadline, '2026-12-02T00:00:00+09:00');
});
test('an explicit unknown discount clears a stale catalog rate and filter match', () => {
  const merged = mergeDeals([{ name: 'Sale', discount: null }], [{ name: 'Sale', discount: 50, benefit: '50% OFF' }]);
  assert.equal(merged[0].discount, null);
  assert.equal(merged[0].benefit, '割引率は未確認');
  assert.equal(filterDeals(merged, { minDiscount: 30 }, now).length, 0);
});
const deals = [
  { id: 'half', name: '半額', group: 'AI', field: 'API', offerType: '年額', discount: 50, deadline: '2026-11-21' },
  { id: 'bonus', name: '20%増量', group: 'AI', field: 'API', offerType: '増量', discount: null, deadline: null },
  { id: 'ended', name: '終了', group: '買い物', field: '家電', discount: 90, deadline: '2026-11-18' },
  { id: 'next', name: '予定', group: '買い物', field: '家電', discount: 30, starts: '2026-11-20T00:00:00+09:00', deadline: '2026-11-30' }
];
test('official context survives feed updates and supports campaign and service search', () => {
  const catalog = [{ id: 'router', name: 'Router', serviceSummary: 'APIアグリゲータ', serviceUrl: 'https://example.com/service', campaignType: 'モデル公開' }];
  const merged = mergeDeals([{ name: 'Router', discount: 50 }, { name: 'Student', url: 'https://example.com', serviceSummary: 'AI開発', serviceUrl: 'javascript:alert(1)', campaignType: '学割' }], catalog);
  assert.equal(merged[0].serviceSummary, catalog[0].serviceSummary);
  assert.equal(merged[0].serviceUrl, catalog[0].serviceUrl);
  assert.equal(merged[1].serviceUrl, null);
  assert.deepEqual(filterDeals(merged, { query: 'アグリゲータ' }, now).map(d => d.id), ['router']);
  assert.equal(filterDeals(merged, { campaignType: '学割', query: '学割' }, now).length, 1);
});
test('combined filters exclude bonuses, unknown dates and expired offers', () => {
  assert.deepEqual(filterDeals(deals, { status: 'live', group: 'AI', minDiscount: 30, deadline: 3 }, now).map(d => d.id), ['half']);
  assert.deepEqual(filterDeals(deals, { status: 'upcoming', query: '予定' }, now).map(d => d.id), ['next']);
  assert.deepEqual(filterDeals(deals, { status: 'live', onlySaved: true, saved: ['bonus'] }, now).map(d => d.id), ['bonus']);
});
test('sorts keep unknown discounts last and expired deadlines separate', () => {
  assert.deepEqual(sortDeals(deals, 'discount', now).map(d => d.id), ['ended', 'half', 'next', 'bonus']);
  assert.deepEqual(sortDeals(deals, 'deadline', now).map(d => d.id), ['half', 'next', 'bonus', 'ended']);
});
