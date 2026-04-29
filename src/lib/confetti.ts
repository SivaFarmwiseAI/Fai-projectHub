import confetti from "canvas-confetti";

/** Standard celebration burst — use when a milestone is marked complete */
export function fireMilestoneCelebration() {
  const count = 160;
  const defaults = { origin: { y: 0.65 }, zIndex: 9999 };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  fire(0.25, { spread: 26,  startVelocity: 55 });
  fire(0.20, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.10, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.10, { spread: 120, startVelocity: 45 });
}

/** Subtle side-cannon burst — lighter celebration */
export function fireSideCannons() {
  const end = Date.now() + 1200;
  const colors = ["#3b82f6", "#6366f1", "#22c55e", "#f59e0b"];

  (function frame() {
    confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors, zIndex: 9999 });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors, zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
