// On-screen controls for phones and tablets: a floating joystick on the left half
// (appears under the thumb; push to the rim to run) and a jump button on the right.
// Writes into input.stick / input.jump. Hidden on devices without touch.
const STICK = { radius: 56, deadZone: 0.12, area: 0.45 };   // area: left fraction of the screen

export const hasTouch = () => navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;

export function createTouchControls(root, input) {
  const ui = document.createElement('div');
  ui.id = 'touch';
  ui.innerHTML = `
    <div class="stick-zone"></div>
    <div class="stick"><div class="knob"></div></div>
    <button class="jump" aria-label="jump">
      <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 4l-7 8h4.5v7h5v-7H19z" fill="currentColor"/></svg>
    </button>`;
  root.appendChild(ui);
  const zone = ui.querySelector('.stick-zone'), base = ui.querySelector('.stick'), knob = ui.querySelector('.knob');
  const jump = ui.querySelector('.jump');

  let id = null, cx = 0, cy = 0;
  const home = () => {
    base.classList.remove('active');
    base.style.left = base.style.top = '';
    knob.style.transform = '';
    input.stick.x = input.stick.y = 0;
  };
  const move = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy), max = STICK.radius;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / max);
    input.stick.x = m > STICK.deadZone ? dx / max : 0;
    input.stick.y = m > STICK.deadZone ? -dy / max : 0;          // up on screen = forward
  };

  zone.addEventListener('pointerdown', e => {
    if (id !== null) return;
    id = e.pointerId;
    input.touch = true;
    try { zone.setPointerCapture(id); } catch { /* synthetic or already-gone pointer */ }
    cx = e.clientX; cy = e.clientY;
    base.style.left = `${cx}px`; base.style.top = `${cy}px`;
    base.classList.add('active');
    move(cx, cy);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e.clientX, e.clientY); });
  const end = e => { if (e.pointerId !== id) return; id = null; home(); };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  const press = on => e => { e.preventDefault(); input.jump = on; jump.classList.toggle('down', on); };
  jump.addEventListener('pointerdown', press(true));
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) jump.addEventListener(t, press(false));

  const ICON = {
    jump: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 4l-7 8h4.5v7h5v-7H19z" fill="currentColor"/></svg>',
    dash: '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V12V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-3.3-5a1.5 1.5 0 0 1 2.4-1.8z" fill="currentColor"/></svg>',
  };
  ICON.kick = '<svg viewBox="0 0 24 24" width="34" height="34"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.6l4.2 3-1.6 4.9H9.4l-1.6-4.9z" fill="currentColor"/></svg>';
  ICON.reel = '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M12 4a8 8 0 1 0 8 8h-2.5A5.5 5.5 0 1 1 12 6.5V9l4-3.5L12 2z" fill="currentColor"/></svg>';
  const show = on => ui.classList.toggle('on', on);
  show(hasTouch());
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') show(true); }, { capture: true });
  return { el: ui, show, stickArea: STICK.area, setAction: kind => { jump.innerHTML = ICON[kind] || ICON.jump; } };
}
