// Fixed-order frame loop. Systems register update(dt, time); dt is clamped so a tab
// switch doesn't make the world jump.
const systems = [];
let last = 0, time = 0, running = false;

export function addSystem(fn) { systems.push(fn); }

/** Advance all systems by dt without rendering (tests / benchmarks). */
export function tick(dt) { time += dt; for (const fn of systems) fn(dt, time); }

export function startLoop(render) {
  if (running) return;
  running = true;
  last = performance.now();
  const frame = now => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    for (const fn of systems) fn(dt, time);
    render(dt, time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
