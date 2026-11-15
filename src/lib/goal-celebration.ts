type GoalCelebrationOptions = {
  goalId?: string;
  goalName?: string;
  completedAt?: string | Date | null;
  imageSrc?: string;
  imageSlug?: string | null;
  icon?: string;
};

type CardOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
  imageSrc?: string;
};

const CARD_RATIO = 2 / 3;
const CARD_WIDTH = 380;
const CARD_HOLD_MS = 2200;
const GOAL_COMPLETE_SOUND = "/sounds/goal-complete.mp3";
const GOAL_ICON_ASSETS: Record<string, string> = {
  shield: "shield",
  plane: "airplane",
  house: "house",
  target: "target",
  car: "target",
};

// Prepare audio + origin during the save gesture; celebrate only after success.
export function prepareGoalCelebration(
  options: GoalCelebrationOptions = {},
): (saved: boolean) => void {
  // Create during the user gesture so playback is allowed after the request.
  const sound = createGoalSound();
  const origin = captureGoalOrigin(options.goalId);
  const imageSrc = resolveGoalImageSrc({
    imageSrc: options.imageSrc || origin?.imageSrc,
    imageSlug: options.imageSlug,
    icon: options.icon,
  });
  return (saved) => {
    if (!saved) return;
    playGoalSound(sound);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        throwConfetti(document.body, { maxMs: 1400 });
      } catch {
        // A visual effect must never interrupt saving a goal.
      }
      return;
    }
    try {
      void runCardCelebration(origin, { ...options, imageSrc });
    } catch {
      // A visual effect must never interrupt saving a goal.
    }
  };
}

function createGoalSound() {
  try {
    const audio = new Audio(GOAL_COMPLETE_SOUND);
    audio.preload = "auto";
    void audio.load();
    return audio;
  } catch {
    return undefined;
  }
}

function playGoalSound(sound?: HTMLAudioElement) {
  try {
    const audio = sound ?? new Audio(GOAL_COMPLETE_SOUND);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // Sound is decorative.
  }
}

function resolveGoalImageSrc(options: {
  imageSrc?: string;
  imageSlug?: string | null;
  icon?: string;
}) {
  if (options.imageSrc) return options.imageSrc;
  if (options.imageSlug) {
    if (options.imageSlug.startsWith("data:image/")) return options.imageSlug;
    if (options.imageSlug.startsWith("/")) return options.imageSlug;
    return `/illustrations/categories/${options.imageSlug}.webp`;
  }
  if (options.icon) {
    const name = GOAL_ICON_ASSETS[options.icon] || "target";
    return `/illustrations/${name}.webp`;
  }
  return undefined;
}

function captureGoalOrigin(goalId?: string): CardOrigin | null {
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
  const image =
    card.querySelector<HTMLImageElement>("img.illustration, img.category-image, img") ||
    null;
  const raw =
    image?.getAttribute("src") ||
    image?.currentSrc ||
    image?.src ||
    undefined;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    imageSrc: raw || undefined,
  };
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function runCardCelebration(
  origin: CardOrigin | null,
  options: GoalCelebrationOptions,
) {
  document.querySelector(".goal-celebration-overlay")?.remove();

  const width = Math.min(
    CARD_WIDTH,
    window.innerWidth - 40,
    Math.floor((window.innerHeight - 80) * CARD_RATIO),
  );
  const height = Math.round(width / CARD_RATIO);
  const overlay = document.createElement("div");
  overlay.className = "goal-celebration-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const confettiHost = document.createElement("div");
  confettiHost.className = "goal-celebration-confetti-host";

  const backdrop = document.createElement("div");
  backdrop.className = "goal-celebration-backdrop";

  const stage = document.createElement("div");
  stage.className = "goal-celebration-stage";

  const flyer = document.createElement("div");
  flyer.className = "goal-celebration-flyer";
  flyer.innerHTML = buildLumeCardHtml({
    name: options.goalName || "Meta",
    imageSrc:
      options.imageSrc ||
      resolveGoalImageSrc({
        imageSrc: origin?.imageSrc,
        imageSlug: options.imageSlug,
        icon: options.icon,
      }),
    completedAt: options.completedAt ?? new Date(),
  });

  const shine = flyer.querySelector(".goal-lume-shine");
  stage.append(flyer);
  // Confetti sits behind the blurred backdrop; card stays above.
  overlay.append(confettiHost, backdrop, stage);
  document.body.append(overlay);

  const centerLeft = (window.innerWidth - width) / 2;
  const centerTop = Math.max(36, (window.innerHeight - height) / 2 - 12);
  // Enter and exit from below the vertical center of the viewport.
  const belowTop = window.innerHeight + 28;

  Object.assign(flyer.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${centerLeft}px`,
    top: `${belowTop}px`,
    transform: pose(0.88, 0, 12),
    opacity: "0",
  });

  let stopConfetti: (() => void) | undefined;
  const cleanup = () => {
    stopConfetti?.();
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

  // Rise from below center into the dialog position.
  await animateElement(
    flyer,
    [
      {
        top: `${belowTop}px`,
        transform: pose(0.88, 0, 12),
        opacity: 0,
      },
      {
        top: `${centerTop}px`,
        transform: pose(1, 0, -8),
        opacity: 1,
      },
    ],
    {
      duration: 520,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  flyer.classList.add("is-spinning");
  try {
    stopConfetti = throwConfetti(confettiHost);
  } catch {
    // Confetti is decorative.
  }

  // Spin with luminous foil reflection sweeping across the face.
  if (shine instanceof HTMLElement) {
    void animateElement(
      shine,
      [
        { transform: "translateX(-130%) skewX(-18deg)", opacity: 0 },
        {
          transform: "translateX(-20%) skewX(-18deg)",
          opacity: 0.95,
          offset: 0.35,
        },
        { transform: "translateX(130%) skewX(-18deg)", opacity: 0.2 },
      ],
      {
        duration: 980,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );
  }

  await animateElement(
    flyer,
    [
      { transform: pose(1, 0, -8) },
      { transform: pose(1.04, 180, 6) },
      { transform: pose(1, 360, -4) },
    ],
    {
      duration: 980,
      easing: "cubic-bezier(0.42, 0, 0.58, 1)",
      fill: "forwards",
    },
  );

  // Hold for reading before the card exits.
  await wait(CARD_HOLD_MS);

  stopConfetti?.();
  stopConfetti = undefined;

  // Exit below the center of the screen — keep the card fully opaque.
  await Promise.all([
    animateElement(
      flyer,
      [
        {
          top: `${centerTop}px`,
          transform: pose(1, 360, -4),
          opacity: 1,
        },
        {
          top: `${belowTop}px`,
          transform: pose(0.88, 360, 12),
          opacity: 1,
        },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "forwards",
      },
    ),
    animateElement(
      backdrop,
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: 420,
        delay: 80,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
  ]);

  cleanup();
}

function buildLumeCardHtml({
  name,
  imageSrc,
  completedAt,
}: {
  name: string;
  imageSrc?: string;
  completedAt: string | Date | null;
}) {
  const art = imageSrc
    ? `<img class="goal-lume-art-image" src="${escapeAttr(imageSrc)}" alt="" draggable="false" />`
    : `<div class="goal-lume-art-fallback" aria-hidden="true"></div>`;
  return `
    <div class="goal-lume-card">
      <div class="goal-lume-face goal-lume-front">
        <div class="goal-lume-glow" aria-hidden="true"></div>
        <div class="goal-lume-pattern" aria-hidden="true"></div>
        <div class="goal-lume-shine" aria-hidden="true"></div>
        <div class="goal-lume-content">
          <div class="goal-lume-art">${art}</div>
          <h3 class="goal-lume-title">${escapeHtml(name)}</h3>
          <p class="goal-lume-date">${escapeHtml(formatCompletedDate(completedAt))}</p>
        </div>
      </div>
      <div class="goal-lume-face goal-lume-back" aria-hidden="true">
        <div class="goal-lume-glow"></div>
        <div class="goal-lume-pattern"></div>
        <div class="goal-lume-mark">clara.</div>
      </div>
    </div>
  `;
}

function formatCompletedDate(value: string | Date | null) {
  const date =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function pose(scale: number, rotateY: number, rotateX: number) {
  return `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
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

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function throwConfetti(
  host: HTMLElement = document.body,
  options: { maxMs?: number } = {},
) {
  const canvas = document.createElement("canvas");
  canvas.className = "goal-confetti";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return () => {};
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
  host.append(canvas);
  let previous = performance.now();
  let frame = 0;
  let stopped = false;
  let timer = 0;
  function cleanup() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    if (timer) window.clearTimeout(timer);
    canvas.remove();
    window.removeEventListener("pagehide", cleanup);
  }
  window.addEventListener("pagehide", cleanup, { once: true });
  if (options.maxMs) {
    timer = window.setTimeout(cleanup, options.maxMs);
  }
  function draw(now: number) {
    if (stopped) return;
    const dt = Math.min((now - previous) / 1000, 0.04);
    previous = now;
    context!.clearRect(0, 0, width, height);
    context!.globalAlpha = 1;
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-0.55 * dt);
      particle.vy += 540 * dt;
      particle.rotation += particle.spin * dt;
      // Recycle flakes that fall off-screen so confetti lasts the whole hold.
      if (particle.y > height + 40) {
        const side = Math.random() > 0.5 ? 1 : -1;
        particle.x = side === 1 ? 0 : width;
        particle.y = height * (0.35 + Math.random() * 0.3);
        particle.vx =
          side * (140 + Math.random() * Math.min(width * 0.55, 560));
        particle.vy = -280 - Math.random() * 420;
      }
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
  return cleanup;
}
