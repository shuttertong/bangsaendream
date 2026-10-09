// First-time controls card: how to move, look around and talk — for a keyboard and mouse or for
// a touch screen, whichever is in use. The first two lines tick off as the player does them; then
// the card points at the goal marker and goes away for good (flag `tutorial`). The same lines
// are listed under ⓘ, so they can be read again at any time.
import { t, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';

export const TUTORIAL = {
  walk: 4, look: 90,          // metres walked and pixels of camera drag that tick a line off
  bye: 5,                     // seconds the "follow the arrow" line stays before the card leaves
  lines: { key: ['howMoveKey', 'howLookKey', 'howActKey'], touch: ['howMoveTouch', 'howLookTouch', 'howActTouch'] },
};

const kind = () => (document.querySelector('#touch.on') ? 'touch' : 'key');
/** The controls as text (ⓘ panel). */
export const howToLines = () => [...TUTORIAL.lines[kind()], 'howGoal'].map(k => t(k));

export function createTutorial({ root, player, input }) {
  let el = null, mode = null, walked = 0, looked = 0, last = null, bye = 0;

  function draw() {
    if (!el) return;
    mode = kind();
    el.querySelector('h3').textContent = t('howTitle');
    el.querySelector('button').textContent = t('tutOk');
    el.querySelectorAll('p').forEach((p, i) => { p.querySelector('span').innerHTML = t(TUTORIAL.lines[mode][i]); });
    el.querySelector('.tut-go').textContent = t('tutGo');
  }
  function finish() {
    if (!el) return;
    const card = el;
    el = null;
    card.classList.add('out');
    setTimeout(() => card.remove(), 500);
    P.setFlag('tutorial');
  }
  onLang(draw);

  return {
    get active() { return !!el; },
    /** Show the card (new players only: once grandma has been met, the controls are known). */
    start() {
      const s = P.get();
      if (el || s.flags.tutorial || s.met.grandma) return;
      el = document.createElement('div');
      el.className = 'tut';
      el.innerHTML = '<h3></h3><p><i></i><span></span></p><p><i></i><span></span></p><p class="info"><i></i><span></span></p><div class="tut-go"></div><button></button>';
      (root.querySelector('#ui .head') || root).appendChild(el);
      el.querySelector('button').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); finish(); });
      draw();
    },
    update(dt) {
      if (!el) return;
      if (kind() !== mode) draw();                                    // a first touch switches the card to the touch controls
      const p = player.state;
      const step = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
      if (step < 1) walked += step;                                   // a jump in position is fast travel, not walking
      last = { x: p.x, z: p.z };
      looked += Math.abs(input.drag.x) + Math.abs(input.drag.y) + (input.down('KeyQ') || input.down('KeyE') ? dt * 120 : 0);
      const [move, look] = el.querySelectorAll('p');
      move.classList.toggle('ok', walked >= TUTORIAL.walk);
      look.classList.toggle('ok', looked >= TUTORIAL.look);
      if (walked >= TUTORIAL.walk && looked >= TUTORIAL.look) {
        el.classList.add('done');
        bye += dt;
        if (bye > TUTORIAL.bye) finish();
      }
    },
  };
}
