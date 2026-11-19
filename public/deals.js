export const JST_OFFSET = 9 * 60 * 60 * 1000;

export function safeUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}

export function deadlineTime(value) {
  if (!value) return null;
  // A date-only source means end of that day in Japan, not midnight UTC.
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59+09:00` : value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function statusOf(deal, now = Date.now()) {
  const end = deadlineTime(deal.deadline);
  if (end !== null && end < now) return 'ended';
  const start = deal.starts ? Date.parse(deal.starts) : NaN;
  return start > now ? 'upcoming' : 'active';
}

export function daysLeft(deal, now = Date.now()) {
  const end = deadlineTime(deal.deadline);
  if (end === null) return null;
  return Math.floor((end + JST_OFFSET) / 86400000) - Math.floor((now + JST_OFFSET) / 86400000);
}

export function mergeDeals(feed, catalog) {
  const result = catalog.map(d => ({ ...d }));
  for (const raw of feed) {
    if (!raw || typeof raw.name !== 'string') continue;
    const existing = result.find(d => d.feedName === raw.name || d.name === raw.name);
    if (existing) {
      // Curated records may have a more precise timestamp or split offers at one URL.
      if (Object.hasOwn(raw, 'deadline') && (!existing.preciseDeadline || raw.deadline?.includes('T'))) existing.deadline = raw.deadline;
      for (const key of ['group', 'field', 'offerType', 'benefit', 'description', 'conditions', 'starts', 'checkedAt', 'serviceSummary', 'serviceUrl', 'campaignType']) {
        if (typeof raw[key] === 'string') existing[key] = raw[key];
      }
      if (typeof raw.titleJa === 'string') existing.name = raw.titleJa;
      if (Object.hasOwn(raw, 'discount') && raw.discount === null) {
        if (existing.discount != null && !raw.benefit) existing.benefit = '割引率は未確認';
        existing.discount = null;
      } else if (typeof raw.discount === 'number' && raw.discount >= 0 && raw.discount <= 100) existing.discount = raw.discount;
      continue;
    }
    result.push({ id: `feed-${raw.name}`, name: raw.titleJa || raw.name,
      group: raw.group || '未分類', field: raw.field || '未分類', offerType: raw.offerType || '未整理',
      benefit: raw.benefit || '新しく見つかったセール', description: raw.description || raw.name,
      discount: typeof raw.discount === 'number' && raw.discount >= 0 && raw.discount <= 100 ? raw.discount : null,
      deadline: raw.deadline || null, starts: raw.starts || null,
      conditions: raw.conditions || '詳細な条件・割引率は出典をご確認ください。',
      serviceSummary: raw.serviceSummary || '', serviceUrl: raw.serviceUrl || null, campaignType: raw.campaignType || '未確認',
      url: raw.url, checkedAt: raw.checkedAt || null, fresh: true });
  }
  return result.map(d => ({ ...d, url: safeUrl(d.url), serviceUrl: safeUrl(d.serviceUrl) }));
}

export function filterDeals(deals, filters, now = Date.now()) {
  const query = (filters.query || '').trim().toLocaleLowerCase('ja');
  return deals.filter(d => {
    const status = statusOf(d, now);
    if (filters.status === 'live' && status === 'ended') return false;
    if (filters.status === 'active' && status !== 'active') return false;
    if (filters.status === 'upcoming' && status !== 'upcoming') return false;
    if (filters.status === 'ended' && status !== 'ended') return false;
    if (filters.group && d.group !== filters.group) return false;
    if (filters.field && d.field !== filters.field) return false;
    if (filters.offerType && d.offerType !== filters.offerType) return false;
    if (filters.campaignType && d.campaignType !== filters.campaignType) return false;
    if (filters.minDiscount && (d.discount == null || d.discount < Number(filters.minDiscount))) return false;
    if (filters.deadline) {
      const days = daysLeft(d, now);
      if (days === null || status === 'ended' || days > Number(filters.deadline)) return false;
    }
    if (filters.onlySaved && !filters.saved?.includes(d.id)) return false;
    return !query || [d.name, d.description, d.benefit, d.conditions, d.field, d.serviceSummary, d.campaignType].join(' ').toLocaleLowerCase('ja').includes(query);
  });
}

export function sortDeals(deals, sort, now = Date.now()) {
  return [...deals].sort((a, b) => {
    if (sort === 'discount') return (b.discount ?? -1) - (a.discount ?? -1) || a.name.localeCompare(b.name, 'ja');
    if (sort === 'name') return a.name.localeCompare(b.name, 'ja');
    if (sort === 'new') return Number(Boolean(b.fresh)) - Number(Boolean(a.fresh)) || (Date.parse(b.checkedAt) || 0) - (Date.parse(a.checkedAt) || 0);
    const aEnded = statusOf(a, now) === 'ended', bEnded = statusOf(b, now) === 'ended';
    return Number(aEnded) - Number(bEnded) || (deadlineTime(a.deadline) ?? Infinity) - (deadlineTime(b.deadline) ?? Infinity) || a.name.localeCompare(b.name, 'ja');
  });
}
