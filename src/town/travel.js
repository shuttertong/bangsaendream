// Travel menu: pick a place, fade out, move the kid there (facing whoever stands
// there), fade in. Also the bag panel, which shares the modal styling.
import { t, tr } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { ITEMS } from '../shared/items.js';

const ICON = { partner: '🏪', market: '🛍️', anchor: '⚓', sign: '🐬', speedboat: '🚤', home: '🏠', beach: '🏖️', tube: '🛟', food: '🥗', crab: '🦀', boat: '🦑', hill: '🐒', go: '⚫' };
const FADE_MS = 380, ARRIVE = 2.6;      // metres in front of the place's NPC

export function createTravel(root, { places, player, camera, npcAt, collision = null }) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = '<div class="panel"><h2></h2><div class="list"></div><button class="close"></button></div>';
  const fade = document.createElement('div');
  fade.id = 'fade';
  root.append(modal, fade);
  const h2 = modal.querySelector('h2'), list = modal.querySelector('.list'), closeBtn = modal.querySelector('.close');
  let mode = null;

  const close = () => { modal.classList.remove('on'); mode = null; };
  closeBtn.addEventListener('pointerdown', e => { e.stopPropagation(); close(); });
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && mode) close();
    else if (e.code === 'KeyM' && mode !== 'travel') openTravel();
    else if (e.code === 'KeyB' && mode !== 'bag') openBag();
  });

  function go(place) {
    close();
    fade.classList.add('on');
    setTimeout(() => {
      const npc = npcAt(place.id);
      const [x, z, yaw] = npc ? arrival(place) : [place.x, place.z, place.yaw];
      player.place(x, z, yaw);
      camera.setYaw(yaw + Math.PI);
      camera.snap?.();
      P.setPos(x, z, yaw);
      setTimeout(() => fade.classList.remove('on'), 60);
    }, FADE_MS);
  }

  /** A walkable spot ARRIVE m from the place's NPC, facing it: in front of it if free, else the nearest free angle. */
  function arrival(place) {
    for (const d of [ARRIVE, ARRIVE + 1, ARRIVE + 2]) for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      const a = place.yaw + turn, x = place.x + Math.sin(a) * d, z = place.z + Math.cos(a) * d;
      if (!collision || collision.free(x, z, 0.45)) return [x, z, a + Math.PI];      // face the NPC
    }
    return [place.x + Math.sin(place.yaw) * ARRIVE, place.z + Math.cos(place.yaw) * ARRIVE, place.yaw + Math.PI];
  }

  function openTravel() {
    mode = 'travel';
    h2.textContent = t('travelTitle');
    closeBtn.textContent = t('close');
    list.innerHTML = '';
    const p = player.state;
    const here = Object.values(places).reduce((b, q) => (!b || Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? q : b), null);
    for (const place of Object.values(places)) {
      const b = document.createElement('button');
      b.className = 'dest';
      const isHere = place === here && Math.hypot(place.x - p.x, place.z - p.z) < 25;
      b.innerHTML = `<span class="ic">${ICON[place.icon] || '📍'}</span><span class="nm">${tr(place.name)}</span>${isHere ? `<span class="here">${t('here')}</span>` : ''}`;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); go(place); });
      list.appendChild(b);
    }
    modal.classList.add('on');
  }

  function openBag() {
    mode = 'bag';
    h2.textContent = t('bag');
    closeBtn.textContent = t('close');
    const bag = P.get().bag, ids = Object.keys(bag);
    list.innerHTML = ids.length ? '' : `<p class="empty">${t('bagEmpty')}</p>`;
    for (const id of ids) {
      const it = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'dest';
      row.innerHTML = `<span class="ic">${it?.icon || '•'}</span><span class="nm">${it ? tr(it.name) : id}</span><span class="here">×${bag[id]}</span>`;
      list.appendChild(row);
    }
    modal.classList.add('on');
  }

  return { openTravel, openBag, go, get open() { return !!mode; } };
}
