// HUD overlay: baht counter, current goal (tap it to be shown the way), travel / bag / language
// buttons, the "talk to…" prompt (tappable on touch screens) and short toasts. The toasts sit in
// the same column as the top bar, so they always appear under it, however many rows it wraps to.
import { t, tr, getLang, setLang, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { CREDITS } from '../shared/credits.js';
import { howToLines } from './tutorial.js';

const ICONS = {
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 6 2v11.6l-6-2V6.2z" fill="currentColor"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M8 7V6a4 4 0 0 1 8 0v1h3l1 14H4L5 7h3zm2 0h4V6a2 2 0 0 0-4 0v1z" fill="currentColor"/></svg>',
};

export function createHUD(root, { onTravel, onBag, onTalk, onGoal, audio }) {
  const el = document.createElement('div');
  el.id = 'ui';
  el.innerHTML = `
    <div class="head">
      <div class="top">
        <div class="baht"></div>
        <button class="goal"><span class="goal-k"></span><span class="goal-t"></span><span class="goal-go">➤</span></button>
        <div class="btns">
          <button class="b-travel">${ICONS.map}<span></span></button>
          <button class="b-bag">${ICONS.bag}<span></span></button>
          <button class="b-lang"></button>
          <button class="b-sound"></button>
          <button class="b-info">ⓘ</button>
        </div>
      </div>
      <div class="toasts"></div>
    </div>
    <button class="prompt"></button>
    <div class="modal credits"><div class="panel"><h2></h2><div class="c-body"></div><button class="close"></button></div></div>`;
  root.appendChild(el);
  const $ = s => el.querySelector(s);
  const baht = $('.baht'), goal = $('.goal'), prompt = $('.prompt'), toasts = $('.toasts');
  let goalFn = () => '', promptKey = null, promptName = null, promptVars = null;

  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  $('.b-travel').addEventListener('pointerdown', stop(onTravel));
  $('.b-bag').addEventListener('pointerdown', stop(onBag));
  $('.b-lang').addEventListener('pointerdown', stop(() => setLang(getLang() === 'th' ? 'en' : 'th')));
  prompt.addEventListener('pointerdown', stop(onTalk));
  goal.addEventListener('pointerdown', stop(() => onGoal?.()));
  $('.b-sound').addEventListener('pointerdown', stop(() => { audio?.setMuted(!audio.muted); refresh(); }));
  const credits = $('.credits');
  $('.b-info').addEventListener('pointerdown', stop(() => { audio?.play('click'); drawCredits(); credits.classList.add('on'); }));
  credits.querySelector('.close').addEventListener('pointerdown', stop(() => credits.classList.remove('on')));
  function drawCredits() {
    credits.querySelector('h2').textContent = t('infoTitle');
    credits.querySelector('.close').textContent = t('close');
    credits.querySelector('.c-body').innerHTML = `<h3>${t('howTitle')}</h3>${howToLines().map(l => `<p>${l}</p>`).join('')}`
      + CREDITS.map(c => `<h3>${tr(c.head)}</h3>${c.lines.map(l => `<p>${tr(l)}</p>`).join('')}`).join('');
  }

  function refresh() {
    baht.textContent = t('baht', { n: P.get().baht.toLocaleString() });
    $('.b-travel span').textContent = t('travel');
    $('.b-bag span').textContent = t('bag');
    $('.b-lang').textContent = t('lang');
    $('.b-travel').setAttribute('aria-label', t('travel'));
    $('.b-bag').setAttribute('aria-label', t('bag'));
    $('.b-sound').textContent = audio?.muted ? '🔇' : '🔊';
    $('.b-sound').setAttribute('aria-label', t('sound'));
    $('.b-info').setAttribute('aria-label', t('infoTitle'));
    goal.setAttribute('aria-label', t('goalShow'));
    $('.goal-k').textContent = t('objective');
    const g = goalFn();
    $('.goal-t').textContent = g;
    goal.classList.toggle('on', !!g);
    if (promptKey) prompt.innerHTML = `${t(promptKey, { name: promptName ? tr(promptName) : '', ...promptVars })} <kbd>${t('talkKey')}</kbd>`;
  }
  P.onChange(refresh);
  onLang(refresh);

  return {
    refresh,
    setGoal(fn) { goalFn = fn; refresh(); },
    /** Show the action prompt: an i18n key ('talk', 'board', 'alight') + optional name, or null to hide. */
    setPrompt(key, name = null, vars = null) {
      if (key === promptKey && name === promptName && JSON.stringify(vars) === JSON.stringify(promptVars)) return;
      promptKey = key; promptName = name; promptVars = vars;
      prompt.classList.toggle('on', !!key);
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
