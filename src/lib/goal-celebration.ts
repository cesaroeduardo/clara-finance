// Prepare audio during the save gesture; celebrate only after the request succeeds.
export function prepareGoalCelebration(): (saved: boolean) => void {
  let audio: AudioContext | undefined;
  try {
    audio = new AudioContext();
    void audio.resume().catch(() => {});
  } catch {
    // Confetti still works when audio is unavailable.
  }
  return (saved) => {
    if (!saved) {
      void audio?.close().catch(() => {});
      return;
    }
    if (audio) {
      try {
        const start = audio.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          const note = audio!.createOscillator();
          const volume = audio!.createGain();
          const time = start + index * 0.085;
          note.type = "sine";
          note.frequency.value = frequency;
          volume.gain.setValueAtTime(0, time);
          volume.gain.linearRampToValueAtTime(0.065, time + 0.012);
          volume.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
          note.connect(volume);
          volume.connect(audio!.destination);
          note.start(time);
          note.stop(time + 0.4);
        });
        window.setTimeout(() => void audio?.close().catch(() => {}), 1100);
      } catch {
        void audio.close().catch(() => {});
      }
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      throwConfetti();
    } catch {
      // A visual effect must never interrupt saving a goal.
    }
  };
}

function throwConfetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "goal-confetti";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  const green =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--success")
      .trim() || "#007a45";
  const colors = [green, "#22a86b", "#65cf96", "#b0edc9"];
  const particles = Array.from({ length: 110 }, (_, index) => {
    const side = index % 2 ? 1 : -1;
    return {
      x: side === 1 ? 0 : width,
      y: height * 0.65,
      vx: side * (140 + Math.random() * Math.min(width * 0.65, 650)),
      vy: -300 - Math.random() * 470,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 14,
      size: 5 + Math.random() * 5,
      color: colors[index % colors.length],
    };
  });
  document.body.append(canvas);
  const started = performance.now();
  let previous = started;
  let frame = 0;
  function cleanup() {
    cancelAnimationFrame(frame);
    canvas.remove();
    window.removeEventListener("pagehide", cleanup);
  }
  window.addEventListener("pagehide", cleanup, { once: true });
  function draw(now: number) {
    const elapsed = (now - started) / 1000;
    if (elapsed > 2.6) {
      cleanup();
      return;
    }
    const dt = Math.min((now - previous) / 1000, 0.04);
    previous = now;
    context!.clearRect(0, 0, width, height);
    context!.globalAlpha = Math.min(1, (2.6 - elapsed) / 0.7);
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-0.6 * dt);
      particle.vy += 520 * dt;
      particle.rotation += particle.spin * dt;
      context!.save();
      context!.translate(particle.x, particle.y);
      context!.rotate(particle.rotation);
      context!.fillStyle = particle.color;
      context!.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        particle.size / 2,
      );
      context!.restore();
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
}
