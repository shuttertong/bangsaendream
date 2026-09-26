// Title card (first tap also unlocks audio on iOS) and the ending card.
import { t } from '../shared/i18n.js';
import * as P from '../shared/progress.js';

export function showTitle(root, { onStart }) {
  const el = document.createElement('div');
  el.id = 'title';
  const returning = !!P.get().met.grandma;
  el.innerHTML = `
    <div class="t-card">
      <h1>${t('title')}</h1>
      <p class="t-sub">${t('titleSub')}</p>
      <button class="t-go">${returning ? t('titleContinue') : t('titlePlay')}</button>
      <p class="t-hint">🔊 ${t('titleHint')}</p>
    </div>`;
  root.appendChild(el);
  const go = e => { e?.preventDefault(); e?.stopPropagation(); el.classList.add('out'); setTimeout(() => el.remove(), 600); onStart?.(); removeEventListener('keydown', key); };
  const key = e => { if (e.code === 'Enter' || e.code === 'Space') go(e); };
  el.querySelector('.t-go').addEventListener('pointerdown', go);
  addEventListener('keydown', key);
  return el;
}

export function showEnding(root, audio) {
  const s = P.get();
  const items = Object.values(s.bag).reduce((a, n) => a + n, 0);
  const plays = Object.values(s.best).reduce((a, b) => a + (b.plays || 0), 0);
  const el = document.createElement('div');
  el.id = 'ending';
  el.innerHTML = `
    <div class="t-card">
      <p class="e-sun">🌅</p>
      <h1>${t('endTitle')}</h1>
      <p class="t-sub">${t('endText')}</p>
      <p class="e-stats">${t('endStats', { baht: s.baht.toLocaleString(), items, plays })}</p>
      <button class="t-go">${t('keepPlaying')}</button>
    </div>`;
  root.appendChild(el);
  audio?.play('fanfare');
  el.querySelector('.t-go').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('out'); setTimeout(() => el.remove(), 600); });
}
