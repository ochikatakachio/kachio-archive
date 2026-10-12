'use strict';
(() => {
  const archive = window.ARCHIVE;
  const expected = archive.works.filter(w => w.visible !== false && (w.destinations || []).some(d => d.name === 'zeta' && d.status === 'published'));
  const listeners = [];
  const numberFromLabel = label => {
    const match = String(label).normalize('NFKC').trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)(万|億)?$/);
    return match ? Math.round(Number(match[1]) * ({万:10000,億:100000000}[match[2]] || 1)) : NaN;
  };
  function valid(candidate, allowPending = false) {
    if (!candidate || candidate.schemaVersion !== 1 || !candidate.works || typeof candidate.works !== 'object') return false;
    const time = Date.parse(candidate.updatedAt);
    if (!Number.isFinite(time) || time > Date.now() + 300000) return false;
    return expected.every(w => {
      const e = candidate.works[w.id];
      if (!e && allowPending) return true;
      const url = w.destinations.find(d => d.name === 'zeta' && d.status === 'published').url;
      return e && Number.isSafeInteger(e.count) && e.count >= 0 && e.count === numberFromLabel(e.label) && e.sourceUrl === url && Number.isSafeInteger(e.sourceOrder) && e.sourceOrder >= 0;
    });
  }
  let state = valid(window.ZETA_STATS, true) ? window.ZETA_STATS : {works:{},updatedAt:null};
  const entry = w => expected.some(x => x.id === w.id) ? state.works[w.id] || null : null;
  const ranked = list => [...list].sort((a,b) => {
    const x = entry(a), y = entry(b);
    if (!x && !y) return Number(expected.some(w=>w.id===b.id)) - Number(expected.some(w=>w.id===a.id));
    if (!x) return 1;
    if (!y) return -1;
    return y.count - x.count || x.sourceOrder - y.sourceOrder;
  });
  function caption() {
    if (!state.updatedAt) return 'zetaのトーク数は現在確認できません。';
    const date = new Date(state.updatedAt).toLocaleString('ja-JP', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const stale = Date.now() - Date.parse(state.updatedAt) > 48 * 60 * 60 * 1000;
    return `zetaの公開トーク数が多い順。最終確認：${date}${stale ? '（更新待ち）' : ''}。`;
  }
  function apply(candidate) {
    if (!valid(candidate) || Date.parse(candidate.updatedAt) <= Date.parse(state.updatedAt || '1970-01-01')) return false;
    state = candidate;
    listeners.forEach(update => update());
    return true;
  }
  window.ArchiveStats = {entry, ranked, caption, subscribe:update => listeners.push(update), apply};
  // The bundled script also works when index.html is opened directly from a ZIP.
  if (typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch('assets/zeta-stats.json', {cache:'no-store',signal:controller.signal})
      .then(response => response.ok ? response.json() : null).then(apply).catch(() => {}).finally(() => clearTimeout(timer));
  }
})();
