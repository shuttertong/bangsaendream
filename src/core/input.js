// Keyboard + pointer state. Consumers read and then clear the per-frame deltas.
export function createInput(el) {
  const keys = new Set();
  const state = {
    keys,
    drag: { x: 0, y: 0 },      // left-drag delta in px (rotate)
    pan: { x: 0, y: 0 },       // right-drag delta in px
    wheel: 0,
    down: key => keys.has(key),
    endFrame() { state.drag.x = state.drag.y = state.pan.x = state.pan.y = 0; state.wheel = 0; },
  };

  addEventListener('keydown', e => keys.add(e.code));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let button = -1, px = 0, py = 0;
  el.addEventListener('pointerdown', e => {
    button = e.button; px = e.clientX; py = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (button < 0) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    const t = button === 0 && !e.shiftKey ? state.drag : state.pan;
    t.x += dx; t.y += dy;
  });
  const up = e => { button = -1; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); state.wheel += Math.sign(e.deltaY); }, { passive: false });
  return state;
}
