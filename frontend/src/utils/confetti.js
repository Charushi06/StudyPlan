
/**
 * Triggers a polished confetti celebration animation.
 * Optimized for the StudyPlan aesthetic with custom colors and timing.
 */
export function triggerConfetti() {
  if (typeof confetti !== 'function') return;

  const count = 150;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      // Custom palette matching the StudyPlan design system
      colors: [
        '#4f46e5', // Indigo (Primary)
        '#10b981', // Success (Green)
        '#8b5cf6', // Purple
        '#f59e0b', // Warning (Amber)
        '#3b82f6'  // Blue
      ]
    });
  }

  // Layered burst for a richer, more premium feel
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}
