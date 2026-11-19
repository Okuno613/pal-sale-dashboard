import { mergeDeals, filterDeals, sortDeals, statusOf, daysLeft, deadlineTime } from './deals.js';

const $ = selector => document.querySelector(selector);
const form = $('#filters');
const fieldNames = ['group', 'field', 'offerType', 'minDiscount', 'deadline', 'status', 'onlySaved'];
const labels = { group: '系統', field: '分野', offerType: '特典', minDiscount: '割引率', deadline: '期限', status: '状況' };
let deals = [], lastPayload = null, saved = [], hasData = false;
try { const stored = JSON.parse(localStorage.getItem('pal-saved') || '[]'); if (Array.isArray(stored)) saved = stored.filter(v => typeof v === 'string'); } catch { /* Storage may be unavailable. */ }
const params = new URLSearchParams(location.search);
for (const key of ['minDiscount', 'deadline', 'status']) {
  if ([...form.elements[key].options].some(o => o.value === params.get(key))) form.elements[key].value = params.get(key);
}
form.elements.onlySaved.checked = params.get('saved') === '1';
$('#search').value = params.get('q') || '';
if ([...$('#sort').options].some(o => o.value === params.get('sort'))) $('#sort').value = params.get('sort');
if (matchMedia('(max-width: 760px)').matches) $('#filter-panel').open = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function fmtDate(value, full = false) {
  const time = deadlineTime(value);
  return time === null ? '期限未定' : new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', ...(full ? { year: 'numeric' } : {}) }).format(time);
}
function deadlineLabel(deal) {
  const days = daysLeft(deal), status = statusOf(deal);
  if (status === 'ended') return `${fmtDate(deal.deadline)} 終了`;
  if (days === null) return '期限未定';
  return `${fmtDate(deal.deadline)}まで${days === 0 ? ' · 今日終了' : days <= 3 ? ` · あと${days}日` : ''}`;
}
function persistParams() {
  const next = new URLSearchParams();
  for (const key of fieldNames) {
    const input = form.elements[key];
    if (key === 'onlySaved') { if (input.checked) next.set('saved', '1'); }
    else if (input.value && !(key === 'status' && input.value === 'live')) next.set(key, input.value);
  }
  if ($('#search').value.trim()) next.set('q', $('#search').value.trim());
  if ($('#sort').value !== 'deadline') next.set('sort', $('#sort').value);
  history.replaceState(null, '', location.pathname + (next.size ? `?${next}` : ''));
}
function filters() {
  return Object.fromEntries(fieldNames.map(key => [key, key === 'onlySaved' ? form.elements[key].checked : form.elements[key].value]).concat([['query', $('#search').value], ['saved', saved]]));
}
function saveButton(deal) {
  const button = element('button', 'save', saved.includes(deal.id) ? '★' : '☆');
  button.type = 'button';
  button.setAttribute('aria-label', `${deal.name}を気になるリスト${saved.includes(deal.id) ? 'から外す' : 'に追加'}`);
  button.setAttribute('aria-pressed', String(saved.includes(deal.id)));
  button.addEventListener('click', () => {
    const removing = saved.includes(deal.id);
    saved = removing ? saved.filter(id => id !== deal.id) : [...saved, deal.id];
    try { localStorage.setItem('pal-saved', JSON.stringify(saved)); } catch { /* Still works for this page view. */ }
    render();
    // Restore keyboard focus after the list is redrawn.
    const replacement = [...document.querySelectorAll('.save')].find(b => b.dataset.id === deal.id);
    replacement?.focus({ preventScroll: true });
  });
  button.dataset.id = deal.id;
  return button;
}
function showDetail(deal) {
  const content = $('#detail-content'); content.replaceChildren();
  content.append(element('p', 'eyebrow', `${deal.group} / ${deal.field}`), element('h2', '', deal.name), element('p', 'benefit', deal.benefit), element('p', '', deal.description));
  content.append(element('h3', '', '対象・条件'), element('p', '', deal.conditions));
  content.append(element('h3', '', '期間'), element('p', '', `${deal.starts ? `${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(Date.parse(deal.starts))}から / ` : ''}${deal.deadline ? `${fmtDate(deal.deadline, true)}まで${/^\d{4}-\d{2}-\d{2}$/.test(deal.deadline) ? '（終了時刻は未確認）' : ` ${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(deadlineTime(deal.deadline))} JST`}` : '終了日の記載なし'}`));
  content.append(element('p', 'detail-meta', `割引率: ${deal.discount == null ? '不明・算出対象外' : `${deal.discount}%${deal.maxDiscount ? '（最大）' : ''}`} / 特典: ${deal.offerType}`));
  content.append(element('p', 'detail-meta', deal.checkedAt ? `調査メモ: ${fmtDate(deal.checkedAt, true)}時点。最新の条件は出典で確認してください。` : '新着フィードから追加。詳細は未整理です。'));
  const actions = element('div', 'detail-actions');
  if (deal.url) { const link = element('a', 'button', '出典を見る ↗'); link.href = deal.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link); }
  actions.append(element('span', 'detail-meta', '外部サイトが開きます'));
  content.append(actions);
  $('#detail').showModal();
}
function card(deal) {
  const status = statusOf(deal), article = element('article', `card ${status}`), top = element('div', 'card-top');
  top.append(element('span', 'service-icon', deal.monogram || deal.name.slice(0, 2)));
  if (status !== 'active' || deal.fresh) top.append(element('span', `status-label ${status}`, status === 'upcoming' ? '開催予定' : status === 'ended' ? '終了' : '新着・未整理'));
  top.append(saveButton(deal));
  article.append(top, element('p', 'category', `${deal.field} / ${deal.offerType}`), element('h3', '', deal.name), element('div', 'benefit', deal.benefit), element('p', 'description', deal.description), element('p', 'condition', deal.shortCondition || deal.conditions));
  const bottom = element('div', 'card-bottom'), days = daysLeft(deal);
  bottom.append(element('span', `deadline ${days !== null && days >= 0 && days <= 3 ? 'urgent' : ''}`, deadlineLabel(deal)));
  const button = element('button', 'detail-link', '条件を見る ↗'); button.type = 'button'; button.addEventListener('click', () => showDetail(deal));
  bottom.append(button); article.append(bottom); return article;
}
function render() {
  const state = filters(), filtered = sortDeals(filterDeals(deals, state), $('#sort').value);
  const live = deals.filter(d => statusOf(d) !== 'ended');
  $('#total-count').textContent = live.length;
  $('#soon-count').textContent = live.filter(d => { const days = daysLeft(d); return days !== null && days >= 0 && days <= 3; }).length;
  $('#annual-count').textContent = live.filter(d => d.offerType === '年額').length;
  $('#saved-count').textContent = deals.filter(d => saved.includes(d.id)).length;
  $('#result-count').textContent = `${filtered.length}件 / 全${deals.length}件`;
  $('#cards').replaceChildren(...filtered.map(card));
  $('#empty').hidden = filtered.length > 0;
  const chips = [];
  for (const key of Object.keys(labels)) {
    const input = form.elements[key];
    if (!input.value || key === 'status' && input.value === 'live') continue;
    const chip = element('button', 'filter-chip', `${labels[key]}: ${input.selectedOptions[0].textContent} ×`);
    chip.type = 'button'; chip.addEventListener('click', () => { input.value = key === 'status' ? 'live' : ''; render(); }); chips.push(chip);
  }
  $('#active-filters').replaceChildren(...chips); persistParams();
}
function reset() { form.reset(); $('#search').value = ''; $('#sort').value = 'deadline'; render(); }
function populateOptions(first) {
  for (const key of ['group', 'field', 'offerType']) {
    const select = form.elements[key], previous = first ? params.get(key) : select.value;
    select.replaceChildren(select.options[0]);
    for (const value of [...new Set(deals.map(d => d[key]))].sort((a, b) => a.localeCompare(b, 'ja'))) { const option = element('option', '', value); option.value = value; select.append(option); }
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  }
}
function updateFreshness(payload, error = false) {
  const stamp = payload?.checkedAt || payload?.syncedAt;
  $('#sync-time').textContent = stamp && Number.isFinite(Date.parse(stamp)) ? `${payload.checkedAt ? '巡回' : '同期'}: ${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(Date.parse(stamp))} JST` : '同期時刻を確認できません';
  let warning = '';
  if (error) warning = '再読み込みに失敗しました。表示中のデータを残しています。時間をおいて再度お試しください。';
  else if (!payload.sourceAvailable) warning = '新着フィードを読み込めません。保存済みの調査メモのみ表示しています。';
  else if (stamp && Date.now() - Date.parse(stamp) > 24 * 60 * 60 * 1000) warning = '最終同期から24時間以上経っています。新着がまだ反映されていない可能性があります。';
  $('#feed-warning').textContent = warning; $('#feed-warning').hidden = !warning;
}
async function load() {
  $('#refresh').disabled = true;
  try {
    const response = await fetch('./deals.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to read feed');
    const payload = await response.json();
    if (!Array.isArray(payload.seen) || !Array.isArray(payload.catalog)) throw new Error('Invalid data');
    deals = mergeDeals(payload.seen, payload.catalog);
    populateOptions(!hasData); hasData = true; lastPayload = payload;
    updateFreshness(payload); render();
  } catch {
    updateFreshness(lastPayload, true);
    if (!hasData) { $('#cards').replaceChildren(element('p', '', 'データを読み込めませんでした。「今すぐ読み直す」で再試行してください。')); $('#result-count').textContent = '読み込みエラー'; }
  } finally { $('#refresh').disabled = false; }
}
function updateToday() { $('#today').textContent = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(Date.now()); }
form.addEventListener('change', render); form.addEventListener('submit', e => e.preventDefault());
$('#search').addEventListener('input', render); $('#sort').addEventListener('change', render);
$('#reset').addEventListener('click', reset); $('#empty-reset').addEventListener('click', reset);
$('#refresh').addEventListener('click', load); $('#close-detail').addEventListener('click', () => $('#detail').close());
$('#detail').addEventListener('click', e => { if (e.target === $('#detail')) { const rect = $('#detail').getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) $('#detail').close(); } });
for (const button of document.querySelectorAll('[data-quick]')) button.addEventListener('click', () => {
  form.reset(); $('#search').value = ''; $('#sort').value = 'deadline';
  if (button.dataset.quick === 'soon') form.elements.deadline.value = '3';
  if (button.dataset.quick === 'annual') form.elements.offerType.value = '年額';
  if (button.dataset.quick === 'saved') { form.elements.onlySaved.checked = true; form.elements.status.value = 'all'; }
  render(); $('.results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateToday(); load(); } });
window.addEventListener('storage', e => { if (e.key === 'pal-saved') { try { const next = JSON.parse(e.newValue || '[]'); if (Array.isArray(next)) { saved = next.filter(v => typeof v === 'string'); render(); } } catch { /* Ignore corrupted storage. */ } } });
setInterval(() => { updateToday(); if (!document.hidden) load(); }, 60000);
updateToday(); load();
