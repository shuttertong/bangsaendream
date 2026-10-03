// 👗 The fantasy wardrobe panel: a mirror view of the kid, items by slot, try-on before buying,
// buy with earned baht, wear / take off. Also the daily hooks that bring players back: a baht
// gift once a day and three featured items at a discount that change every day. Worn items go
// into KID_LOOK (hub, every mini-game) and online as indices (multiplayer hello).
import { WARDROBE, SLOTS, SLOT_NAME, RARITY, DAILY, byId, bySlot, featuredToday, priceToday, dayKey, fxLook } from '../shared/wardrobe.js';
import { KID_LOOK } from './kid/model.js';
import { t, tr, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';

const MIRROR = { dist: 2.6, pitch: 0.06 };

export function createWardrobe({ root, player, tpc, hub, auras, audio, onWorn }) {
  const btn = document.createElement('button');
  btn.className = 'b-wardrobe';
  btn.innerHTML = '👗<span></span><i></i>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const modal = document.createElement('div');
  modal.className = 'modal wd-panel';
  modal.innerHTML = `<div class="panel">
      <div class="wd-head"><h2></h2><span class="wd-baht"></span></div>
      <div class="wd-daily"><button class="wd-gift"></button><span class="wd-feat"></span></div>
      <div class="wd-tabs"></div><div class="wd-grid"></div>
      <div class="wd-bar"><span class="wd-sel"></span><button class="wd-act"></button><button class="wd-off"></button></div>
      <button class="close"></button></div>`;
  root.appendChild(modal);
  const $ = q => modal.querySelector(q);
  let open = false, slot = 'hat', selected = null, saved = null, tryOn = null;
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(e); };
  const W = () => P.get().wardrobe;

  // ---------- what the kid wears ----------
  function apply(worn) {
    Object.assign(KID_LOOK, fxLook(worn));
    player.setLook({ ...KID_LOOK });
    if (worn.aura) auras.set('me', worn.aura, v => v.copy(player.kid.mesh.position).setY(player.kid.mesh.position.y + 0.9)); else auras.remove('me');
  }
  const current = () => (tryOn ? { ...W().worn, ...tryOn } : W().worn);

  // ---------- panel ----------
  function refresh() {
    const w = W(), feat = featuredToday(), owned = Object.keys(w.owned).length;
    btn.querySelector('span').textContent = t('wardrobe'); btn.setAttribute('aria-label', t('wardrobe'));
    btn.querySelector('i').hidden = w.gift === dayKey() || !open && false;   // dot while the daily gift is unclaimed
    btn.querySelector('i').hidden = w.gift === dayKey();
    $('h2').textContent = t('wardrobeTitle', { n: owned, total: WARDROBE.length });
    $('.wd-baht').textContent = t('baht', { n: P.get().baht.toLocaleString() });
    $('.wd-gift').textContent = w.gift === dayKey() ? t('giftTaken') : t('giftTake', { n: DAILY.gift });
    $('.wd-gift').disabled = w.gift === dayKey();
    $('.wd-feat').textContent = t('featured', { names: feat.map(id => `${byId[id].icon} ${tr(byId[id].name)}`).join(' · ') });
    $('.wd-tabs').innerHTML = SLOTS.map(s => `<button data-s="${s}" class="${s === slot ? 'on' : ''}">${tr(SLOT_NAME[s])}${w.worn[s] ? ' ●' : ''}</button>`).join('');
    const worn = current();
    $('.wd-grid').innerHTML = bySlot(slot).map(it => {
      const price = priceToday(it, feat), own = !!w.owned[it.id], on = worn[slot] === it.id, sale = price < it.price;
      return `<button class="wd-item ${selected === it.id ? 'sel' : ''} ${on ? 'on' : ''}" data-id="${it.id}" style="--r:${RARITY[it.rarity].color}">
        <span class="wd-ic">${it.icon}</span><span class="wd-nm">${tr(it.name)}</span>
        <span class="wd-pr">${own ? (on ? t('wearing') : t('owned')) : `${sale ? `<s>฿${it.price}</s> ` : ''}฿${price}`}</span>
        <span class="wd-rar">${tr(RARITY[it.rarity])}${sale ? ' · ' + t('sale') : ''}</span></button>`;
    }).join('');
    const it = selected && byId[selected];
    $('.wd-bar').hidden = !it;
    if (it) {
      const own = !!w.owned[it.id], on = w.worn[it.slot] === it.id, price = priceToday(it, feat);
      $('.wd-sel').textContent = `${it.icon} ${tr(it.name)}`;
      $('.wd-act').textContent = own ? (on ? t('takeOff') : t('wear')) : t('buyWear', { n: price });
      $('.wd-act').disabled = !own && P.get().baht < price;
      $('.wd-act').title = !own && P.get().baht < price ? t('notEnough') : '';
      $('.wd-off').hidden = !w.worn[it.slot] || on;
      $('.wd-off').textContent = t('takeOffSlot');
    }
    $('.close').textContent = t('close');
  }
  onLang(refresh); P.onChange(() => { if (open) refresh(); else refresh(); });

  $('.wd-tabs').addEventListener('click', stop(e => { const b = e.target.closest('button'); if (!b) return; slot = b.dataset.s; selected = null; tryOn = null; apply(W().worn); refresh(); }));
  $('.wd-grid').addEventListener('click', stop(e => {
    const b = e.target.closest('.wd-item'); if (!b) return;
    selected = b.dataset.id; tryOn = { [slot]: selected }; apply(current()); audio?.play('click'); refresh();   // try it on
  }));
  $('.wd-act').addEventListener('click', stop(() => {
    const it = byId[selected], w = W(); if (!it) return;
    if (!w.owned[it.id]) {
      const price = priceToday(it);
      if (P.get().baht < price) { hub.hud?.toast(t('notEnough')); return; }
      P.buyWardrobe(it.id, price); hub.hud?.toast(t('bought', { name: tr(it.name) })); audio?.play('coin');
      P.wearWardrobe(it.slot, it.id);
    } else P.wearWardrobe(it.slot, w.worn[it.slot] === it.id ? null : it.id);
    tryOn = null; apply(W().worn); onWorn?.(); refresh();
  }));
  $('.wd-off').addEventListener('click', stop(() => { P.wearWardrobe(slot, null); tryOn = null; apply(W().worn); onWorn?.(); refresh(); }));
  $('.wd-gift').addEventListener('click', stop(() => { if (W().gift === dayKey()) return; P.takeGift(DAILY.gift); audio?.play('coin'); hub.hud?.toast(t('giftGot', { n: DAILY.gift })); refresh(); }));

  // ---------- open / close with the mirror camera ----------
  function show() {
    if (open || document.body.classList.contains('in-game')) return;
    open = true; selected = null; tryOn = null;
    saved = { yaw: tpc.state.yaw, pitch: tpc.state.pitch, dist: tpc.state.dist };
    tpc.setYaw(player.state.yaw); Object.assign(tpc.state, MIRROR); tpc.snap?.();
    modal.classList.add('on'); document.body.classList.add('wardrobe'); refresh(); audio?.play('click');
  }
  function hide() {
    if (!open) return;
    open = false; tryOn = null; apply(W().worn);
    if (saved) { tpc.setYaw(saved.yaw); Object.assign(tpc.state, { pitch: saved.pitch, dist: saved.dist }); }
    modal.classList.remove('on'); document.body.classList.remove('wardrobe');
  }
  btn.addEventListener('pointerdown', stop(() => (open ? hide() : show())));
  $('.close').addEventListener('pointerdown', stop(hide));
  addEventListener('keydown', e => { if (e.target?.tagName === 'INPUT') return; if (e.code === 'KeyK' && !document.body.classList.contains('talking')) (open ? hide() : show()); else if (e.code === 'Escape' && open) hide(); });

  apply(W().worn);   // what was worn last time
  refresh();
  return { get open() { return open; }, show, hide, apply: () => apply(W().worn) };
}
