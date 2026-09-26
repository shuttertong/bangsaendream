// Dynamic resolution: keeps the frame rate up on slower GPUs by lowering the pixel
// ratio when frames are slow, and raising it again when there's headroom.
const Q = {
  min: 0.6,                    // lowest pixel ratio
  max: Math.min(devicePixelRatio, 2),
  slow: 1 / 50, fast: 1 / 70,  // frame-time thresholds (s)
  window: 1.5,                 // seconds of frames averaged before deciding
  step: 0.15,
};

export function createQuality(renderer, onResize) {
  let ratio = Q.max, acc = 0, n = 0;
  renderer.setPixelRatio(ratio);
  return {
    get ratio() { return ratio; },
    /** Feed every frame's dt. Ignores long gaps (tab hidden, throttled pane). */
    update(dt) {
      if (dt > 0.25) { acc = n = 0; return; }
      acc += dt; n++;
      if (acc < Q.window) return;
      const avg = acc / n;
      acc = n = 0;
      let next = ratio;
      if (avg > Q.slow) next = Math.max(Q.min, ratio - Q.step);
      else if (avg < Q.fast) next = Math.min(Q.max, ratio + Q.step / 2);
      if (Math.abs(next - ratio) > 0.01) {
        ratio = next;
        renderer.setPixelRatio(ratio);
        onResize();
      }
    },
  };
}
