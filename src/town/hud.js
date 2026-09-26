// HUD overlay: baht counter, current goal, travel / bag / language buttons, the
// "talk to…" prompt (tappable on touch screens) and short toasts.
import { t, tr, getLang, setLang, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';

const ICONS = {
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 6 2v11.6l-6-2V6.2z" fill="currentColor"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M8 7V6a4 4 0 0 1 8 0v1h3l1 14H4L5 7h3zm2 0h4V6a2 2 0 0 0-4 0v1z" fill="currentColor"/></svg>',
};

export function createHUD(root, { onTravel, onBag, onTalk }) {
  const el = document.createElement('div');
  el.id = 'ui';
  el.innerHTML = `
    <div class="top">
      <div class="baht"></div>
      <div class="goal"><span class="goal-k"></span><span class="goal-t"></span></div>
      <div class="btns">
        <button class="b-travel">${ICONS.map}<span></span></button>
        <button class="b-bag">${ICONS.bag}<span></span></button>
        <button class="b-lang"></button>
      </div>
    </div>
    <button class="prompt"></button>
    <div class="toasts"></div>`;
  root.appendChild(el);
  const $ = s => el.querySelector(s);
  const baht = $('.baht'), goal = $('.goal'), prompt = $('.prompt'), toasts = $('.toasts');
  let goalFn = () => '', promptName = null;

  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  $('.b-travel').addEventListener('pointerdown', stop(onTravel));
  $('.b-bag').addEventListener('pointerdown', stop(onBag));
  $('.b-lang').addEventListener('pointerdown', stop(() => setLang(getLang() === 'th' ? 'en' : 'th')));
  prompt.addEventListener('pointerdown', stop(onTalk));

  function refresh() {
    baht.textContent = t('baht', { n: P.get().baht.toLocaleString() });
    $('.b-travel span').textContent = t('travel');
    $('.b-bag span').textContent = t('bag');
    $('.b-lang').textContent = t('lang');
    $('.b-travel').setAttribute('aria-label', t('travel'));
    $('.b-bag').setAttribute('aria-label', t('bag'));
    $('.goal-k').textContent = t('objective');
    const g = goalFn();
    $('.goal-t').textContent = g;
    goal.classList.toggle('on', !!g);
    if (promptName) prompt.innerHTML = `${t('talk', { name: tr(promptName) })} <kbd>${t('talkKey')}</kbd>`;
  }
  P.onChange(refresh);
  onLang(refresh);

  return {
    refresh,
    setGoal(fn) { goalFn = fn; refresh(); },
    /** Show / hide the talk prompt for an NPC name ({ th, en }) or null. */
    setPrompt(name) {
      if (name === promptName) return;
      promptName = name;
      prompt.classList.toggle('on', !!name);
      refresh();
    },
    toast(text) {
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = text;
      toasts.appendChild(d);
      setTimeout(() => d.classList.add('out'), 2200);
      setTimeout(() => d.remove(), 2800);
    },
    hideDuringTalk(on) { el.classList.toggle('talking', on); },
  };
}
