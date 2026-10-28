// Fixed-order frame loop. Systems register update(dt, time); dt is clamped so a tab
// switch doesn't make the world jump.
// Frame-rate cap: requestAnimationFrame fires at the display's refresh rate (120 Hz on a
// ProMotion phone, tablet or MacBook, 144+ on gaming monitors), which doubles the GPU work for
// no visible gain and heats the device. The loop measures the display's refresh period and
// renders on every n-th vsync so the rate stays near FPS.target: 120 → 60, 144 → 72, 165 → 55,
// 240 → 60; 60 and 90 Hz displays are left alone. dt stays the real elapsed time, so nothing
// moves faster or slower. ?fps=0 lifts the cap, ?fps=30 saves battery (setFrameRate).
const FPS = {
  target: 60,
  keep: 0.9,                   // skip vsyncs only while the result stays above target × keep (so 90 Hz is not cut to 45)
  window: [30, 120],           // callbacks measured before the first decision, and between the next ones
  period: [4, 50],             // believable vsync periods, ms (250 Hz … 20 Hz)
};
const systems = [];
let last = 0, time = 0, running = false, cap = FPS.target;
/** What the loop measured and decided (debug overlay): the display's refresh rate and the vsyncs per frame. */
export const frameInfo = { refresh: 0, every: 1, get cap() { return cap; } };

export function addSystem(fn) { systems.push(fn); }
/** fps: the most frames per second to render; 0 = the display's own rate. */
export function setFrameRate(fps) { cap = Math.max(0, +fps || 0); }

/** Advance all systems by dt without rendering (tests / benchmarks). */
export function tick(dt) { time += dt; for (const fn of systems) fn(dt, time); }

export function startLoop(render, raf = requestAnimationFrame) {
  if (running) return;
  running = true;
  last = performance.now();
  let prev = last, shortest = Infinity, seen = 0, first = true, vsync = 1000 / 60;
  const frame = now => {
    raf(frame);
    // the display's refresh period: the shortest gap between callbacks over a window of them
    // (a GPU that cannot keep up makes every gap longer, and the cap lifts itself)
    const gap = now - prev;
    prev = now;
    if (gap >= FPS.period[0] && gap < shortest) shortest = gap;
    if (++seen >= FPS.window[first ? 0 : 1]) {
      vsync = Math.min(FPS.period[1], Math.max(FPS.period[0], shortest));
      frameInfo.refresh = Math.round(1000 / vsync);
      frameInfo.every = cap ? Math.max(1, Math.floor(frameInfo.refresh / (cap * FPS.keep))) : 1;
      shortest = Infinity; seen = 0; first = false;
    }
    // not this vsync: the frame is due after `every` periods (half a period of slack for timer jitter)
    if (frameInfo.every > 1 && now - last < vsync * (frameInfo.every - 0.5)) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    for (const fn of systems) fn(dt, time);
    render(dt, time);
  };
  raf(frame);
}
