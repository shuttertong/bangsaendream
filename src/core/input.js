// Keyboard + pointer (mouse / touch / pen) state. Consumers read and then clear the
// per-frame deltas. Touch: one finger on the canvas drags the camera, two fingers pinch
// to zoom. The on-screen joystick and jump button (core/touch.js) write `stick` / `jump`.
const PINCH_TO_WHEEL = 0.025;    // wheel steps per pixel of pinch

export function createInput(el) {
  const keys = new Set();
  const state = {
    keys,
    drag: { x: 0, y: 0 },        // one-finger / left-drag delta in px (rotate)
    pan: { x: 0, y: 0 },         // right-drag or shift-drag delta in px
    wheel: 0,
    stick: { x: 0, y: 0 },       // on-screen joystick: x = right, y = forward, length 0..1
    jump: false,                 // on-screen jump button held
    touch: false,                // true once a touch has been seen
    down: key => keys.has(key),
    /** Movement intent from keys + joystick: { f, r, mag } with mag 0..1. */
    axis() {
      let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      let r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let mag = Math.hypot(f, r) ? 1 : 0;
      const s = Math.hypot(state.stick.x, state.stick.y);
      if (s > 0.12) { f = state.stick.y; r = state.stick.x; mag = Math.min(1, s); }
      return { f, r, mag };
    },
    endFrame() { state.drag.x = state.drag.y = state.pan.x = state.pan.y = 0; state.wheel = 0; },
  };

  addEventListener('keydown', e => keys.add(e.code));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); state.stick.x = state.stick.y = 0; state.jump = false; });

  // active pointers on the canvas: id → { x, y, button, shift }
  const ptrs = new Map();
  let pinch = 0;
  const spread = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') state.touch = true;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-gone pointer */ }
    if (ptrs.size === 2) pinch = spread();
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) {                                     // pinch zoom
      const d = spread();
      state.wheel -= (d - pinch) * PINCH_TO_WHEEL;
      pinch = d;
      return;
    }
    const t = p.button === 0 && !p.shift ? state.drag : state.pan;
    t.x += dx; t.y += dy;
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    try { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (ptrs.size === 2) pinch = spread();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); state.wheel += Math.sign(e.deltaY); }, { passive: false });
  // iOS Safari: stop page pinch-zoom / double-tap zoom stealing gestures
  for (const t of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
  return state;
}
