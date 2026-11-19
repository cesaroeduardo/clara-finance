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
const CARD_PIXEL_MAX = 28;
const CARD_PIXEL_IN_MS = 720;
const CARD_PIXEL_OUT_MS = 640;
const GOAL_COMPLETE_SOUND = "/sounds/goal-complete.mp3";
const GOAL_COMPLETE_VIDEO = "/videos/goal-complete.mp4";
const GOAL_SOUND_AT_SEC = 0.6;
const VIDEO_PIXEL_BLOCK = 14;
const VIDEO_OPACITY = 0.9;
const VIDEO_FADE_IN_MS = 900;
const VIDEO_FADE_OUT_MS = 820;
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(() => playGoalSound(sound), GOAL_SOUND_AT_SEC * 1000);
      return;
    }
    try {
      void runCardCelebration(origin, { ...options, imageSrc }, sound);
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
  sound?: HTMLAudioElement,
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

  const videoHost = document.createElement("div");
  videoHost.className = "goal-celebration-video-host";

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
  // Pixel video sits behind the dim overlay; card stays above.
  overlay.append(videoHost, backdrop, stage);
  document.body.append(overlay);

  const centerLeft = (window.innerWidth - width) / 2;
  const centerTop = Math.max(36, (window.innerHeight - height) / 2 - 12);

  Object.assign(flyer.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${centerLeft}px`,
    top: `${centerTop}px`,
    transform: pose(1, 0, -8),
    opacity: "0",
  });
  videoHost.style.opacity = "0";

  let stopVideo: (() => void) | undefined;
  const cleanup = () => {
    stopVideo?.();
    overlay.remove();
    window.removeEventListener("pagehide", cleanup);
  };
  window.addEventListener("pagehide", cleanup, { once: true });

  try {
    stopVideo = startCelebrationVideo(videoHost, sound);
  } catch {
    window.setTimeout(() => playGoalSound(sound), GOAL_SOUND_AT_SEC * 1000);
  }

  await Promise.all([
    animateElement(
      backdrop,
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: VIDEO_FADE_IN_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
    animateElement(
      videoHost,
      [{ opacity: 0 }, { opacity: VIDEO_OPACITY }],
      {
        duration: VIDEO_FADE_IN_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
  ]);

  // Materialize in place: coarse pixels resolve into the sharp card.
  await pixelateFlyer(flyer, "in");

  flyer.classList.add("is-spinning");

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

  // Dissolve out in place: sharp card breaks into coarse pixels.
  const pixelOut = pixelateFlyer(flyer, "out");
  await Promise.all([
    pixelOut,
    animateElement(
      backdrop,
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: VIDEO_FADE_OUT_MS,
        delay: 80,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
    animateElement(
      videoHost,
      [{ opacity: VIDEO_OPACITY }, { opacity: 0 }],
      {
        duration: VIDEO_FADE_OUT_MS,
        delay: 80,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    ),
  ]);

  cleanup();
}

async function pixelateFlyer(flyer: HTMLElement, direction: "in" | "out") {
  const duration = direction === "in" ? CARD_PIXEL_IN_MS : CARD_PIXEL_OUT_MS;
  const fromBlock = direction === "in" ? CARD_PIXEL_MAX : 1;
  const toBlock = direction === "in" ? 1 : CARD_PIXEL_MAX;

  // Keep the live card hidden on enter so only the pixel canvas is seen.
  if (direction === "in") {
    flyer.style.opacity = "0";
    flyer.style.visibility = "visible";
  }
  await waitForFlyerImages(flyer);
  await yieldFrame();

  const source = await rasterizeFlyer(flyer);
  if (!source) {
    if (direction === "in") {
      await animateElement(
        flyer,
        [
          { opacity: 0, transform: pose(0.94, 0, -8) },
          { opacity: 1, transform: pose(1, 0, -8) },
        ],
        {
          duration,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );
      return;
    }
    await animateElement(
      flyer,
      [
        { opacity: 1, transform: pose(1, 360, -4) },
        { opacity: 0, transform: pose(0.94, 360, -4) },
      ],
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "forwards",
      },
    );
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "goal-celebration-pixel-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    source.remove();
    flyer.style.opacity = direction === "in" ? "1" : "0";
    return;
  }

  const rect = flyer.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.round(rect.width));
  const cssHeight = Math.max(1, Math.round(rect.height));
  canvas.width = source.width;
  canvas.height = source.height;
  Object.assign(canvas.style, {
    width: `${cssWidth}px`,
    height: `${cssHeight}px`,
    left: `${rect.left}px`,
    top: `${rect.top}px`,
  });

  // Swap to the pixel layer before the live card can flash.
  flyer.style.opacity = "0";
  flyer.parentElement?.append(canvas);

  const buffer = document.createElement("canvas");
  const bufferContext = buffer.getContext("2d", { alpha: true });
  if (!bufferContext) {
    canvas.remove();
    source.remove();
    flyer.style.opacity = direction === "in" ? "1" : "0";
    return;
  }

  const ease =
    direction === "in"
      ? (t: number) => 1 - (1 - t) ** 3
      : (t: number) => t ** 2;
  const started = performance.now();

  await new Promise<void>((resolve) => {
    const drawFrame = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const p = ease(t);
      const block = Math.max(1, fromBlock + (toBlock - fromBlock) * p);
      paintPixelated(source, context, buffer, bufferContext, block);
      canvas.style.opacity =
        direction === "in"
          ? String(0.35 + 0.65 * Math.min(1, p * 1.35))
          : String(1 - p * 0.15);
      if (t < 1) {
        requestAnimationFrame(drawFrame);
        return;
      }
      resolve();
    };
    requestAnimationFrame(drawFrame);
  });

  canvas.remove();
  source.remove();
  flyer.style.opacity = direction === "in" ? "1" : "0";
}

function paintPixelated(
  source: HTMLCanvasElement,
  dest: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  bufferContext: CanvasRenderingContext2D,
  block: number,
) {
  const width = source.width;
  const height = source.height;
  const smallW = Math.max(1, Math.floor(width / block));
  const smallH = Math.max(1, Math.floor(height / block));
  buffer.width = smallW;
  buffer.height = smallH;
  bufferContext.clearRect(0, 0, smallW, smallH);
  bufferContext.imageSmoothingEnabled = true;
  bufferContext.drawImage(source, 0, 0, smallW, smallH);
  dest.clearRect(0, 0, width, height);
  dest.imageSmoothingEnabled = false;
  dest.drawImage(buffer, 0, 0, smallW, smallH, 0, 0, width, height);
}

async function rasterizeFlyer(flyer: HTMLElement) {
  const width = flyer.offsetWidth;
  const height = flyer.offsetHeight;
  if (width < 8 || height < 8) return null;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const clone = flyer.cloneNode(true) as HTMLElement;
  clone.classList.remove("is-spinning");
  Object.assign(clone.style, {
    position: "relative",
    left: "0",
    top: "0",
    opacity: "1",
    visibility: "visible",
    transform: "none",
    filter: "none",
    margin: "0",
    width: `${width}px`,
    height: `${height}px`,
  });

  await inlineCloneImages(clone);

  const root = getComputedStyle(document.documentElement);
  const varNames = [
    "--background",
    "--foreground",
    "--muted-foreground",
    "--border",
    "--card",
    "--font-sans",
  ];
  const rootVars = varNames
    .map((name) => {
      const value = root.getPropertyValue(name).trim();
      return value ? `${name}:${value}` : "";
    })
    .filter(Boolean)
    .join(";");

  const styles = collectDocumentCss();
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.setAttribute(
    "style",
    `${rootVars};width:${width}px;height:${height}px;background:transparent;overflow:hidden;`,
  );
  const styleTag = document.createElement("style");
  styleTag.textContent = styles;
  wrapper.append(styleTag, clone);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * ratio)}" height="${Math.round(height * ratio)}"><foreignObject width="${width}" height="${height}" transform="scale(${ratio})">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`;
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return canvas;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function collectDocumentCss() {
  const chunks: string[] = [];
  const relevant = /goal-lume|goal-celebration-flyer|:root|html|body|--background|--foreground|--font-sans/i;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (relevant.test(rule.cssText)) chunks.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheets are unavailable.
    }
  }
  if (chunks.length === 0) {
    for (const node of document.querySelectorAll("style")) {
      const text = node.textContent;
      if (text && relevant.test(text)) chunks.push(text);
    }
  }
  return chunks.join("\n");
}

async function waitForFlyerImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

async function inlineCloneImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      const src = image.currentSrc || image.src;
      if (!src || src.startsWith("data:")) return;
      try {
        const dataUrl = await fetchAsDataUrl(src);
        if (dataUrl) {
          image.setAttribute("src", dataUrl);
          image.removeAttribute("srcset");
        }
      } catch {
        // Keep the original src; foreignObject may still succeed for same-origin.
      }
    }),
  );
}

async function fetchAsDataUrl(src: string) {
  const response = await fetch(src, { credentials: "same-origin" });
  if (!response.ok) return null;
  const blob = await response.blob();
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("pixel snapshot failed"));
    image.src = url;
  });
}

function yieldFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function startCelebrationVideo(
  host: HTMLElement,
  sound?: HTMLAudioElement,
) {
  const video = document.createElement("video");
  video.className = "goal-celebration-video-source";
  video.src = GOAL_COMPLETE_VIDEO;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "goal-celebration-video-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return () => {};

  const buffer = document.createElement("canvas");
  const bufferContext = buffer.getContext("2d", { alpha: false });
  if (!bufferContext) return () => {};

  host.append(canvas, video);

  let frame = 0;
  let stopped = false;
  let soundPlayed = false;

  function layout() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function coverSource(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
  ) {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = targetWidth / scale;
    const drawHeight = targetHeight / scale;
    return {
      sx: (sourceWidth - drawWidth) / 2,
      sy: (sourceHeight - drawHeight) / 2,
      sw: drawWidth,
      sh: drawHeight,
    };
  }

  function draw() {
    if (stopped || !context || !bufferContext) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const width = canvas.width;
      const height = canvas.height;
      const smallW = Math.max(1, Math.floor(width / VIDEO_PIXEL_BLOCK));
      const smallH = Math.max(1, Math.floor(height / VIDEO_PIXEL_BLOCK));
      buffer.width = smallW;
      buffer.height = smallH;
      const src = coverSource(
        video.videoWidth,
        video.videoHeight,
        smallW,
        smallH,
      );
      bufferContext.filter = "grayscale(1) contrast(1.08)";
      bufferContext.imageSmoothingEnabled = true;
      bufferContext.drawImage(
        video,
        src.sx,
        src.sy,
        src.sw,
        src.sh,
        0,
        0,
        smallW,
        smallH,
      );
      bufferContext.filter = "none";
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, width, height);
      context.drawImage(buffer, 0, 0, smallW, smallH, 0, 0, width, height);
    }
    if (!soundPlayed && video.currentTime >= GOAL_SOUND_AT_SEC) {
      soundPlayed = true;
      playGoalSound(sound);
    }
    frame = requestAnimationFrame(draw);
  }

  function onResize() {
    layout();
  }

  function cleanup() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pagehide", cleanup);
    video.pause();
    video.removeAttribute("src");
    video.load();
    canvas.remove();
    video.remove();
  }

  layout();
  window.addEventListener("resize", onResize);
  window.addEventListener("pagehide", cleanup, { once: true });
  frame = requestAnimationFrame(draw);
  void video.play().catch(() => {
    // Autoplay can fail; sound still fires from the time gate if frames advance.
    window.setTimeout(() => {
      if (!soundPlayed) {
        soundPlayed = true;
        playGoalSound(sound);
      }
    }, GOAL_SOUND_AT_SEC * 1000);
  });
  return cleanup;
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

