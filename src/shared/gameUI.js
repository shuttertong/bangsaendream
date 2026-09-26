// DOM overlay for a mini-game round: intro card, top bar (time, catches, baht),
// pop-up messages, quit button and the results screen. Generic enough for the other
// mini-games to reuse (texts come from i18n / species tables).
import { t, tr } from './i18n.js';

/**
 * Summarise catches for results(): catches [{ id, size, price }] + species table →
 * { rows for the results list, total baht, biggest catch }.
 */
export function summarize(catches, species) {
  const by = {};
  for (const c of catches) {
    const sp = species.find(s => s.id === c.id);
    const b = by[c.id] || (by[c.id] = { icon: sp.icon, name: sp.name, count: 0, best: 0, baht: 0 });
    b.count++; b.best = Math.max(b.best, c.size); b.baht += c.price;
  }
  const total = catches.reduce((s, c) => s + c.price, 0);
  const biggest = catches.reduce((m, c) => (c.size > (m?.size || 0) ? c : m), null);
  return { rows: Object.values(by), total, biggest };
}

export function createGameUI(root, { title, how, keys }) {
  const el = document.createElement('div');
  el.id = 'game-ui';
  el.innerHTML = `
    <div class="g-top">
      <div class="g-pill g-time"></div>
      <div class="g-pill g-count"></div>
      <div class="g-pill g-baht"></div>
      <button class="g-quit"></button>
    </div>
    <div class="g-pops"></div>
    <div class="g-card g-intro">
      <h2></h2><p class="g-how"></p><p class="g-keys"></p><button class="g-go"></button>
    </div>
    <div class="g-card g-results" hidden>
      <h2></h2><div class="g-list"></div><div class="g-sum"></div><button class="g-back"></button>
    </div>`;
  root.appendChild(el);
  const $ = s => el.querySelector(s);
  $('.g-intro h2').textContent = title;
  $('.g-how').textContent = how;
  $('.g-keys').textContent = keys;
  $('.g-go').textContent = t('start');
  $('.g-quit').textContent = t('quit');

  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  let onStart = null, onQuit = null, onBack = null;
  $('.g-go').addEventListener('pointerdown', stop(() => { $('.g-intro').hidden = true; onStart?.(); }));
  $('.g-quit').addEventListener('pointerdown', stop(() => onQuit?.()));
  $('.g-back').addEventListener('pointerdown', stop(() => onBack?.()));

  return {
    set onStart(f) { onStart = f; }, set onQuit(f) { onQuit = f; }, set onBack(f) { onBack = f; },
    /** time: seconds left, or a string shown instead (e.g. the wave number). */
    bar(time, count, baht, countLabel = t('caught')) {
      if (typeof time === 'string') { $('.g-time').textContent = time; $('.g-time').classList.remove('low'); }
      else {
        const m = Math.floor(time / 60), s = Math.floor(time % 60);
        $('.g-time').textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
        $('.g-time').classList.toggle('low', time < 15);
      }
      $('.g-count').textContent = `${countLabel} ${count}`;
      $('.g-baht').textContent = `฿${baht}`;
    },
    pop(text, kind = '') {
      const d = document.createElement('div');
      d.className = `g-pop ${kind}`;
      d.textContent = text;
      $('.g-pops').appendChild(d);
      setTimeout(() => d.remove(), 1600);
    },
    /** rows: [{ icon, name: {th,en}, count, best (cm) | detail (text), baht }] */
    results(rows, total, record) {
      $('.g-top').hidden = true;
      const r = $('.g-results');
      r.hidden = false;
      r.querySelector('h2').textContent = t('results');
      const list = r.querySelector('.g-list');
      list.innerHTML = rows.length ? '' : `<p class="g-none">${t('none')}</p>`;
      for (const row of rows) {
        const d = document.createElement('div');
        d.className = 'g-row';
        d.innerHTML = `<span class="ic">${row.icon}</span><span class="nm">${tr(row.name)} ×${row.count}</span><span class="sz">${row.detail ?? t('cm', { n: row.best })}</span><span class="bt">฿${row.baht}</span>`;
        list.appendChild(d);
      }
      r.querySelector('.g-sum').innerHTML = `${t('total')} <b>฿${total}</b>${record ? ` <span class="rec">${t('newRecord')}</span>` : ''}`;
      r.querySelector('.g-back').textContent = t('back');
    },
    dispose() { el.remove(); },
  };
}
