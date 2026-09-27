// Dialogue: runs an NPC script (roster.js) in a speech box. Text types out grapheme by
// grapheme (Thai vowels/tone marks stay with their consonant) and drives the speaker's
// mouth shape. Tap / click / F / Enter / Space: finish the line, then next.
import { tr, t } from '../../shared/i18n.js';
import * as P from '../../shared/progress.js';

const SPEED = 38;                 // graphemes per second
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
const graphemes = s => (seg ? [...seg.segment(s)].map(x => x.segment) : [...s]);

// Mouth shape for a grapheme (Thai vowels first, then Latin letters)
const SHAPES = [
  [/[าะัำ]/, 'open'], [/[ิีึืเแ]/, 'wide'], [/[ุูโอ]/, 'round'], [/[ใไ]/, 'open'],
  [/[aAhH]/, 'open'], [/[eEiIyY]/, 'wide'], [/[oOuUwW]/, 'round'], [/[mMbBpP]/, 'closed'],
  [/[\s.,!?…'"]/, 'closed'],
];
export function mouthFor(g) {
  for (const [re, shape] of SHAPES) if (re.test(g)) return shape;
  return 'half';
}

export function createTalk(root, { onGame, onCoop, onToast, onEnding, audio }) {
  const box = document.createElement('div');
  box.id = 'talk';
  box.innerHTML = '<div class="who"></div><div class="line"></div><div class="choices"></div><div class="more">▼</div>';
  root.appendChild(box);
  const who = box.querySelector('.who'), line = box.querySelector('.line'), choices = box.querySelector('.choices');

  let npc = null, steps = [], typing = null, onEnd = null, waitingChoice = false;

  function type(text) {
    const gs = graphemes(text);
    typing = { gs, i: 0, acc: 0 };
    line.textContent = '';
    box.classList.remove('done');
  }

  function run() {
    while (steps.length) {
      const st = steps.shift();
      if (st.say) { type(tr(st.say)); return; }
      if (st.give?.baht) { P.addBaht(st.give.baht); onToast(t('gotBaht', { n: st.give.baht })); }
      if (st.flag) P.setFlag(st.flag);
      if (st.take) P.addItem(st.take, -1);
      if (st.ending) { close(); onEnding?.(); return; }
      if (st.quest) P.setQuest(st.quest[0], st.quest[1]);
      if (st.game) { close(); onGame(st.game); return; }
      if (st.coop) { close(); (onCoop || onGame)(st.coop); return; }
      if (st.ask) {
        waitingChoice = true;
        choices.innerHTML = '';
        for (const opt of st.ask) {
          const b = document.createElement('button');
          b.textContent = tr(opt.label);
          b.onclick = e => { e.stopPropagation(); waitingChoice = false; choices.innerHTML = ''; steps = [...opt.then, ...steps]; run(); };
          choices.appendChild(b);
        }
        box.classList.add('done');
        return;
      }
    }
    close();
  }

  function advance() {
    if (!npc || waitingChoice) return;
    if (typing && typing.i < typing.gs.length) {       // finish the line first
      line.textContent = typing.gs.join('');
      typing.i = typing.gs.length;
      npc.setMouth('closed');
      box.classList.add('done');
      return;
    }
    run();
  }

  function open(n, save) {
    npc = n;
    steps = [...n.def.script(save)];
    who.textContent = tr(n.def.name);
    box.classList.add('on');
    choices.innerHTML = '';
    waitingChoice = false;
    n.setTalking(true);
    P.meet(n.id);
    run();
  }

  function close() {
    box.classList.remove('on');
    if (npc) npc.setTalking(false);
    npc = null; typing = null; steps = [];
    onEnd?.();
  }

  function update(dt) {
    if (!typing || !npc || typing.i >= typing.gs.length) return;
    typing.acc += dt * SPEED;
    while (typing.acc >= 1 && typing.i < typing.gs.length) {
      const g = typing.gs[typing.i++];
      line.textContent += g;
      npc.setMouth(mouthFor(g));
      if (typing.i % 2 && !/\s/.test(g)) audio?.play('blip');
      typing.acc -= 1;
    }
    if (typing.i >= typing.gs.length) { npc.setMouth('closed'); box.classList.add('done'); }
  }

  box.addEventListener('pointerdown', e => { e.stopPropagation(); advance(); });
  addEventListener('keydown', e => {
    if (!npc) return;
    if (['KeyF', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); advance(); }
    if (e.code === 'Escape') close();
  });

  return {
    open, close, update, advance,
    get active() { return !!npc; },
    set onEnd(fn) { onEnd = fn; },
  };
}
