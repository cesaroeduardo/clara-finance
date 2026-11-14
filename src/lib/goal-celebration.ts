type GoalCelebrationOptions = {
  goalId?: string;
  goalName?: string;
};

type CardSnapshot = {
  html: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

// Prepare audio + card snapshot during the save gesture; celebrate only after success.
export function prepareGoalCelebration(
  options: GoalCelebrationOptions = {},
): (saved: boolean) => void {
  let audio: AudioContext | undefined;
  try {
    audio = new AudioContext();
    void audio.resume().catch(() => {});
  } catch {
    // Confetti still works when audio is unavailable.
  }
  const snapshot = captureGoalCard(options.goalId);
  return (saved) => {
    if (!saved) {
      void audio?.close().catch(() => {});
      return;
    }
    playChime(audio);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        throwConfetti();
      } catch {
        // A visual effect must never interrupt saving a goal.
      }
      return;
    }
    try {
      void runCardCelebration(snapshot, options.goalName);
    } catch {
      try {
        throwConfetti();
      } catch {
        // A visual effect must never interrupt saving a goal.
      }
    }
  };
}

function playChime(audio: AudioContext | undefined) {
  if (!audio) return;
  try {
    const start = audio.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const note = audio.createOscillator();
      const volume = audio.createGain();
      const time = start + index * 0.085;
      note.type = "sine";
      note.frequency.value = frequency;
      volume.gain.setValueAtTime(0, time);
      volume.gain.linearRampToValueAtTime(0.065, time + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
      note.connect(volume);
      volume.connect(audio.destination);
      note.start(time);
      note.stop(time + 0.4);
    });
    window.setTimeout(() => void audio.close().catch(() => {}), 1100);
  } catch {
    void audio.close().catch(() => {});
  }
}

function captureGoalCard(goalId?: string): CardSnapshot | null {
  if (typeof document === "undefined") return null;
  const root = goalId
    ? document.querySelector(`[data-goal-id="${cssEscape(goalId)}"]`)
    : null;
  const card =
    (root?.matches(".goal-card") ? root : null) ||
    root?.querySelector(".goal-card") ||
    document.querySelector(
      goalId
        ? `[data-goal-id="${cssEscape(goalId)}"] .goal-card`
        : ".goals-page-grid .goal-card",
    );
  if (!(card instanceof HTMLElement)) return null;
  const rect = card.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return null;
  return {
    html: card.outerHTML,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function runCardCelebration(
  snapshot: CardSnapshot | null,
  goalName?: string,
) {
  document.querySelector(".goal-celebration-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "goal-celebration-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "goal-celebration-backdrop";

  const stage = document.createElement("div");
  stage.className = "goal-celebration-stage";

  const flyer = document.createElement("div");
  flyer.className = "goal-celebration-flyer";

  const stamp = document.createElement("div");
  stamp.className = "goal-celebration-stamp";
  stamp.textContent = "Concluída";

  const start = snapshot ?? fallbackSnapshot();
  if (snapshot) {
    flyer.innerHTML = snapshot.html;
    const cloned = flyer.querySelector(".goal-card");
    if (cloned instanceof HTMLElement) {
      cloned.classList.add("goal-celebration-card");
      cloned.querySelector(".goal-card-open")?.remove();
      cloned.querySelectorAll("button, a, [tabindex]").forEach((node) => {
        if (node instanceof HTMLElement) {
          node.setAttribute("tabindex", "-1");
          node.setAttribute("aria-hidden", "true");
        }
      });
    }
  } else {
    flyer.innerHTML = `<div class="goal-card goal-celebration-card goal-celebration-fallback"><h3>${escapeHtml(goalName || "Meta")}</h3><p>Concluída</p></div>`;
  }

  flyer.append(stamp);
  stage.append(flyer);
  overlay.append(backdrop, stage);
  document.body.append(overlay);

  const targetScale = Math.min(
    1.22,
    Math.min(
      (window.innerWidth - 48) / start.width,
      (window.innerHeight - 96) / start.height,
    ),
  );
  // left/top track the unscaled box; scale grows from transform-origin center.
  const centerLeft = (window.innerWidth - start.width) / 2;
  const centerTop = Math.max(
    40,
    (window.innerHeight - start.height) / 2 - 20,
  );
  const end = completedGoalsTarget();
  const landScale = 0.28;
  const landLeft = end.left + Math.max(12, (end.width - start.width) / 2);
  const landTop = end.top + 12;

  Object.assign(flyer.style, {
    width: `${start.width}px`,
    height: `${start.height}px`,
    left: `${start.left}px`,
    top: `${start.top}px`,
    transform: pose(1, 0),
  });

  const cleanup = () => {
    overlay.remove();
    window.removeEventListener("pagehide", cleanup);
  };
  window.addEventListener("pagehide", cleanup, { once: true });

  await animateElement(
    backdrop,
    [{ opacity: 0 }, { opacity: 1 }],
    {
      duration: 280,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  // Card leaves the grid and opens like a dialog in the center.
  await animateElement(
    flyer,
    [
      {
        left: `${start.left}px`,
        top: `${start.top}px`,
        transform: pose(1, 0),
      },
      {
        left: `${centerLeft}px`,
        top: `${centerTop}px`,
        transform: pose(targetScale, 0),
      },
    ],
    {
      duration: 440,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  flyer.classList.add("is-spinning");
  try {
    throwConfetti();
  } catch {
    // Confetti is decorative.
  }

  // Full spin on screen.
  await animateElement(
    flyer,
    [
      { transform: pose(targetScale, 0) },
      { transform: pose(targetScale * 1.05, 180) },
      { transform: pose(targetScale, 360) },
    ],
    {
      duration: 820,
      easing: "cubic-bezier(0.42, 0, 0.58, 1)",
      fill: "forwards",
    },
  );

  stamp.classList.add("is-visible");
  await wait(360);

  document
    .querySelector(".completed-goals-card")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Shrink into Metas concluídas.
  await Promise.all([
    animateElement(
      flyer,
      [
        {
          left: `${centerLeft}px`,
          top: `${centerTop}px`,
          transform: pose(targetScale, 360),
          opacity: 1,
        },
        {
          left: `${landLeft}px`,
          top: `${landTop}px`,
          transform: pose(landScale, 360),
          opacity: 0,
        },
      ],
      {
        duration: 580,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
    animateElement(
      backdrop,
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: 420,
        delay: 140,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
  ]);

  cleanup();
}

function pose(scale: number, rotateY: number) {
  return `scale(${scale}) rotateY(${rotateY}deg)`;
}

function fallbackSnapshot(): CardSnapshot {
  const width = Math.min(320, window.innerWidth - 48);
  const height = 220;
  return {
    html: "",
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

function completedGoalsTarget() {
  const target =
    document.querySelector(".completed-goals-card") ||
    document.querySelector(".completed-goals-scroll");
  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
  }
  return {
    left: window.innerWidth / 2 - 120,
    top: window.innerHeight - 120,
    width: 240,
    height: 64,
  };
}

function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  return new Promise<void>((resolve) => {
    const animation = element.animate(keyframes, options);
    animation.finished.then(() => resolve()).catch(() => resolve());
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const theme = getComputedStyle(document.documentElement);
  const primary = theme.getPropertyValue("--primary").trim() || "#000000";
  const primaryForeground =
    theme.getPropertyValue("--primary-foreground").trim() || "#ffffff";
  const foreground =
    theme.getPropertyValue("--foreground").trim() || "#171717";
  const background =
    theme.getPropertyValue("--background").trim() || "#ececec";
  const colors = [primary, primaryForeground, foreground, background];
  const particles = Array.from({ length: 84 }, (_, index) => {
    const side = index % 2 ? 1 : -1;
    const size = 12 + Math.random() * 16;
    return {
      x: side === 1 ? 0 : width,
      y: height * 0.55,
      vx: side * (160 + Math.random() * Math.min(width * 0.7, 720)),
      vy: -340 - Math.random() * 520,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      size,
      tall: size * (0.35 + Math.random() * 0.45),
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
    if (elapsed > 2.8) {
      cleanup();
      return;
    }
    const dt = Math.min((now - previous) / 1000, 0.04);
    previous = now;
    context!.clearRect(0, 0, width, height);
    context!.globalAlpha = Math.min(1, (2.8 - elapsed) / 0.75);
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-0.55 * dt);
      particle.vy += 540 * dt;
      particle.rotation += particle.spin * dt;
      context!.save();
      context!.translate(particle.x, particle.y);
      context!.rotate(particle.rotation);
      context!.fillStyle = particle.color;
      context!.fillRect(
        -particle.size / 2,
        -particle.tall / 2,
        particle.size,
        particle.tall,
      );
      context!.restore();
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
}
