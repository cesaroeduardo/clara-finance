// TUFFUI (https://tuffui.com) · MIT License · Copyright (c) 2026 TUFFUI contributors
// Free to use. If it helps you, you can support it: https://ko-fi.com/yurigokoryan
"use client";

import {
  ChartBar,
  ChartDonut,
  ChartLine,
  ChartLineUp,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  MotionConfig,
  m,
  useReducedMotion,
} from "motion/react";
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { RollingNumber } from "@/components/ui/rolling-number";
import { ShellHeader } from "@/components/ui/surface";
import { PrivacyContext } from "@/components/finance-privacy";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const enter = { duration: 0.125, ease: EASE_OUT };
const exit = { duration: 0.1, ease: EASE_OUT };

export type ChartType = "bar" | "line" | "area" | "donut";

export type ChartSeries = {
  id: string;
  label: string;
  /** One value per label. For a donut, a slice is the sum of its values. */
  values: number[];
  /** Any CSS color. Defaults to the palette by position, so a series keeps its color. */
  color?: string;
};

export type ChartCardProps = {
  data: { labels: string[]; series: ChartSeries[] };
  type?: ChartType;
  title: string;
  subtitle?: string;
  /** Headline in the header, e.g. a total. Rolls when it changes. */
  total?: string;
  /** Formats values in ticks and the tooltip. */
  format?: (value: number) => string;
  /** Stripe the last point (bars) — e.g. a period that isn't over yet. */
  partialLast?: boolean;
  onSelect?: (index: number) => void;
  className?: string;
  embedded?: boolean;
  sparkline?: boolean;
  height?: number;
  legend?: boolean;
  interactive?: boolean;
  sensitive?: boolean;
  showDonutValue?: boolean;
  onActivate?: (index: number) => void;
};

// Clara theme tokens; financial series supply semantic colors.
const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
const icons = {
  bar: ChartBar,
  line: ChartLine,
  area: ChartLineUp,
  donut: ChartDonut,
};

const compact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1000
      ? `${+(n / 1000).toFixed(1)}k`
      : `${+n.toFixed(1)}`;

/** A round step (1, 2, 2.5 or 5 × 10ⁿ) so about four ticks cover the value. */
function niceScale(value: number) {
  if (value <= 0) return { max: 1, step: 0.25 };
  const raw = value / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { max: Math.ceil(value / step - 1e-9) * step, step };
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  // null until measured: the chart draws once at its real width, so entrance
  // animations don't tween from a guessed size.
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      // contentRect is 0 for inline spans (sparklines inside <button>);
      // border box / getBoundingClientRect stay accurate.
      const box = el.getBoundingClientRect().width;
      if (box > 0) setWidth(box);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width ?? 560, width !== null] as const;
}

export function ChartCard({
  data,
  type = "bar",
  title,
  subtitle,
  total,
  format: formatter = compact,
  partialLast = false,
  onSelect,
  className,
  embedded = false,
  sparkline = false,
  height = 200,
  legend = true,
  interactive = true,
  sensitive = true,
  showDonutValue = true,
  onActivate,
}: ChartCardProps) {
  const Container = interactive ? "div" : "span";
  const privateValues = useContext(PrivacyContext) && sensitive;
  const format = (value: number) => formatter(value);
  const spoken = (value: number) =>
    privateValues ? "oculto" : formatter(value);
  const H = height;
  const PAD = sparkline
    ? { top: 6, right: 6, bottom: 6, left: 6 }
    : { top: 8, right: 8, bottom: 22, left: 52 };
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [ref, width, measured] = useWidth();
  const [hiddenSeries, setHidden] = useState<string[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [tipAnchor, setTipAnchor] = useState<{
    left: number;
    top: number;
    center: boolean;
  } | null>(null);

  useEffect(() => setPortalHost(document.body), []);

  const series = data.series.map((s, i) => ({
    ...s,
    color: s.color ?? palette[i % palette.length],
  }));
  const visible = series.filter((s) => !hiddenSeries.includes(s.id));
  const donut = type === "donut";
  const count = donut ? visible.length : data.labels.length;

  // A toggle can remove the point the selection pointed at.
  const activeIndex = active !== null && active < count ? active : null;

  const select = (index: number | null, keyboard: boolean) => {
    setFromKeyboard(keyboard);
    setActive(index);
    if (index !== null) onSelect?.(index);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!count) return;
    const keys: Record<string, number> = {
      ArrowRight: (activeIndex ?? -1) + 1,
      ArrowLeft: (activeIndex ?? count) - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(event.key in keys)) {
      if (event.key === "Escape") select(null, true);
      return;
    }
    event.preventDefault();
    select((keys[event.key] + count) % count, true);
  };

  const innerW = Math.max(width - PAD.left - PAD.right, 40);
  const innerH = H - PAD.top - PAD.bottom;
  const values = visible.flatMap((s) => s.values);
  const lower = values.length
    ? Math.min(...values, ...(sparkline ? [] : [0]))
    : 0;
  const upper = values.length
    ? Math.max(...values, ...(sparkline ? [] : [0]))
    : 1;
  const { max: range, step } = niceScale(
    upper - lower || Math.abs(upper) * 0.1 || 1,
  );
  const min = Math.floor(lower / step) * step;
  const max = Math.max(min + step, Math.ceil(upper / step) * step);
  const y = (v: number) =>
    PAD.top + innerH - ((v - min) / (max - min || range)) * innerH;
  const band = innerW / Math.max(data.labels.length, 1);
  const x = (i: number) =>
    PAD.left +
    (type === "bar"
      ? band * (i + 0.5)
      : (innerW * i) / Math.max(data.labels.length - 1, 1));
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => min + i * step,
  );
  const labelEvery = Math.ceil(
    data.labels.length / Math.max(Math.floor(innerW / 56), 1),
  );

  const summary = donut
    ? visible.map((s) => `${s.label} ${spoken(sum(s.values))}`).join(", ")
    : `${title}: ${visible.map((s) => s.label).join(", ")}. ${data.labels[0] ?? ""} a ${data.labels.at(-1) ?? ""}.`;

  const tooltip =
    activeIndex === null ? null : donut ? (
      <TooltipRows
        title={visible[activeIndex]?.label}
        rows={[
          {
            color: visible[activeIndex]?.color,
            label: "Total",
            value: format(sum(visible[activeIndex]?.values ?? [])),
          },
        ]}
      />
    ) : (
      <TooltipRows
        title={data.labels[activeIndex]}
        rows={visible.map((s) => ({
          color: s.color,
          label: s.label,
          value: format(s.values[activeIndex] ?? 0),
        }))}
      />
    );

  const tipLocalLeft =
    activeIndex === null || donut
      ? 0
      : Math.max(
          0,
          Math.min(x(activeIndex) - 72, width - Math.min(160, width)),
        );

  useLayoutEffect(() => {
    // Keep the last anchor while exiting so the portal tip isn't clipped
    // by overflow:hidden on finance cards / shell bodies.
    if (activeIndex === null) return;
    const el = ref.current;
    if (!el) return;

    const place = () => {
      const rect = el.getBoundingClientRect();
      setTipAnchor(
        donut
          ? {
              left: rect.left + rect.width / 2,
              top: rect.top,
              center: true,
            }
          : {
              left: rect.left + tipLocalLeft,
              top: rect.top,
              center: false,
            },
      );
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [activeIndex, donut, ref, tipLocalLeft]);

  return (
    <MotionConfig reducedMotion="user">
      <Container
        data-slot="chart-card"
        aria-hidden={!interactive || undefined}
        className={cn(
          "tuff-chart",
          !embedded && "rounded-[1.375rem] bg-surface p-1.5",
          className,
        )}
      >
        {!embedded && (
          <ShellHeader
            icon={icons[type]}
            title={title}
            subtitle={subtitle}
            aside={
              total && (
                <span className="amount">
                  {privateValues ? (
                    <span className="sr-only">Valor oculto</span>
                  ) : null}
                  <span aria-hidden={privateValues || undefined}>
                    <RollingNumber
                      value={total}
                      className="text-xl font-medium tracking-tight"
                    />
                  </span>
                </span>
              )
            }
          />
        )}
        <Container
          className={
            embedded
              ? "block min-w-0 w-full"
              : "rounded-2xl bg-surface-inset p-4"
          }
        >
          {legend && !sparkline && series.length > 1 && (
            <div
              role="group"
              aria-label="Séries do gráfico"
              className="mb-3 flex flex-wrap gap-1.5"
            >
              {series.map((s) => {
                const on = !hiddenSeries.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setHidden((h) =>
                        on
                          ? visible.length > 1
                            ? [...h, s.id]
                            : h
                          : h.filter((id) => id !== s.id),
                      )
                    }
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-[background-color,color,opacity,scale] duration-150 ease-out active:scale-[0.97]",
                      on
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground opacity-60 hover:opacity-100",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-[3px]"
                      style={{
                        background: on ? s.color : "transparent",
                        boxShadow: on
                          ? undefined
                          : `inset 0 0 0 1.5px ${s.color}`,
                      }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}

          <Container
            ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement>}
            tabIndex={interactive ? 0 : undefined}
            role="group"
            aria-label={`${title}. Use as setas para consultar os valores.`}
            onKeyDown={(event) => {
              onKeyDown(event);
              if (event.key === "Enter" && activeIndex !== null)
                onActivate?.(activeIndex);
            }}
            onBlur={() => fromKeyboard && setActive(null)}
            className="relative block w-full rounded-xl outline-offset-4"
          >
            <svg
              key={measured ? "measured" : "guess"}
              visibility={measured ? undefined : "hidden"}
              role="img"
              aria-label={summary}
              width={width}
              height={H}
              className="block overflow-hidden"
              onPointerLeave={() => select(null, false)}
            >
              <defs>
                <clipPath id={`${uid}-reveal`}>
                  <m.rect
                    x={0}
                    y={0}
                    height={H}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width }}
                    transition={{ duration: 0.8, ease: EASE_OUT }}
                  />
                </clipPath>
                {series.map((s, i) => (
                  <linearGradient
                    key={s.id}
                    id={`${uid}-fill-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                    <stop
                      offset="100%"
                      stopColor={s.color}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
                {series.map((s, i) => (
                  <pattern
                    key={s.id}
                    id={`${uid}-stripe-${i}`}
                    width="7"
                    height="7"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="7" height="7" fill={s.color} />
                    <rect width="3" height="7" fill="white" opacity="0.22" />
                  </pattern>
                ))}
              </defs>

              {donut ? (
                <Donut
                  series={visible}
                  width={width}
                  activeIndex={activeIndex}
                  instant={fromKeyboard || !!reduce}
                  onHover={(i) => select(i, false)}
                  format={format}
                  height={H}
                  showValue={showDonutValue}
                  onActivate={onActivate}
                />
              ) : (
                <>
                  {!sparkline &&
                    ticks.map((t) => (
                      <g key={t} className="text-muted-foreground">
                        <line
                          x1={PAD.left}
                          x2={width - PAD.right}
                          y1={y(t)}
                          y2={y(t)}
                          stroke="currentColor"
                          strokeOpacity={t === 0 ? 0.18 : 0.08}
                        />
                        <text
                          x={PAD.left - 8}
                          y={y(t)}
                          dy="0.32em"
                          textAnchor="end"
                          fontSize="10"
                          fill="currentColor"
                          className="amount"
                        >
                          {format(t)}
                        </text>
                      </g>
                    ))}
                  {!sparkline &&
                    data.labels.map((label, i) =>
                      i % labelEvery === 0 ? (
                        <text
                          key={`${label}-${i}`}
                          x={x(i)}
                          y={H - 6}
                          textAnchor="middle"
                          fontSize="10"
                          className="fill-muted-foreground"
                        >
                          {label}
                        </text>
                      ) : null,
                    )}

                  {type === "bar"
                    ? data.labels.map((_, i) => {
                        const gap = 2;
                        const groupW = Math.min(
                          band * 0.72,
                          18 * visible.length + gap * (visible.length - 1),
                        );
                        const barW =
                          (groupW - gap * (visible.length - 1)) /
                          Math.max(visible.length, 1);
                        return visible.map((s, j) => {
                          const v = s.values[i] ?? 0;
                          const index = series.findIndex((t) => t.id === s.id);
                          return (
                            <m.rect
                              key={`${s.id}-${i}`}
                              x={x(i) - groupW / 2 + j * (barW + gap)}
                              width={barW}
                              rx={3}
                              initial={reduce ? false : { y: y(0), height: 0 }}
                              animate={{
                                y: Math.min(y(v), y(0)),
                                height: Math.abs(y(0) - y(v)),
                              }}
                              transition={{
                                duration: 0.5,
                                ease: EASE_OUT,
                                delay: reduce ? 0 : i * 0.03,
                              }}
                              fill={
                                partialLast && i === data.labels.length - 1
                                  ? `url(#${uid}-stripe-${index})`
                                  : s.color
                              }
                              opacity={
                                activeIndex === null || activeIndex === i
                                  ? 1
                                  : 0.4
                              }
                              style={{ transition: "opacity 150ms ease-out" }}
                            />
                          );
                        });
                      })
                    : visible.map((s) => {
                        if (!s.values.length) return null;
                        const points = s.values.map(
                          (v, i) => [x(i), y(v)] as const,
                        );
                        const line = points
                          .map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`)
                          .join("");
                        const baseY = sparkline ? H - PAD.bottom : y(0);
                        const area = `${line}L${x(points.length - 1)},${baseY}L${x(0)},${baseY}Z`;
                        return (
                          <g key={s.id}>
                            {type === "area" && (
                              // Revealed left to right with the line, so the fill
                              // never fades in ahead of the stroke that bounds it.
                              <g clipPath={`url(#${uid}-reveal)`}>
                                <m.path
                                  initial={{ d: area }}
                                  animate={{ d: area }}
                                  transition={{
                                    duration: 0.4,
                                    ease: EASE_IN_OUT,
                                  }}
                                  fill={`url(#${uid}-fill-${series.findIndex((t) => t.id === s.id)})`}
                                />
                              </g>
                            )}
                            <m.path
                              initial={
                                reduce ? false : { pathLength: 0, d: line }
                              }
                              animate={{ pathLength: 1, d: line }}
                              transition={{
                                pathLength: { duration: 0.8, ease: EASE_OUT },
                                d: { duration: 0.4, ease: EASE_IN_OUT },
                              }}
                              fill="none"
                              stroke={s.color}
                              strokeWidth={2}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      })}

                  {sparkline &&
                    visible.map(
                      (s) =>
                        s.values.length > 0 && (
                          <circle
                            key={s.id}
                            cx={x(s.values.length - 1)}
                            cy={y(s.values.at(-1)!)}
                            r={2.5}
                            fill={s.color}
                          />
                        ),
                    )}
                  {type !== "bar" && activeIndex !== null && (
                    <g>
                      <line
                        x1={x(activeIndex)}
                        x2={x(activeIndex)}
                        y1={PAD.top}
                        y2={PAD.top + innerH}
                        stroke="currentColor"
                        strokeOpacity={0.25}
                        className="text-foreground"
                      />
                      {visible.map((s) => (
                        <circle
                          key={s.id}
                          cx={x(activeIndex)}
                          cy={y(s.values[activeIndex] ?? 0)}
                          r={4.5}
                          fill={s.color}
                          stroke="var(--surface-inset)"
                          strokeWidth={2}
                        />
                      ))}
                    </g>
                  )}

                  {/* Hit areas, wider than the marks. */}
                  {interactive &&
                    data.labels.map((label, i) => (
                      <rect
                        key={`${label}-${i}`}
                        x={
                          type === "bar"
                            ? x(i) - band / 2
                            : x(i) -
                              innerW / Math.max(data.labels.length - 1, 1) / 2
                        }
                        y={PAD.top}
                        width={
                          type === "bar"
                            ? band
                            : innerW / Math.max(data.labels.length - 1, 1)
                        }
                        height={innerH}
                        fill="transparent"
                        onPointerEnter={() => select(i, false)}
                        onClick={() => {
                          select(i, false);
                          onActivate?.(i);
                        }}
                      />
                    ))}
                </>
              )}
            </svg>

            {portalHost &&
              createPortal(
                <AnimatePresence>
                  {activeIndex !== null && tooltip && tipAnchor && (
                    <m.div
                      key="tip"
                      initial={
                        fromKeyboard ? false : { opacity: 0, scale: 0.97 }
                      }
                      animate={{ opacity: 1, scale: 1, transition: enter }}
                      exit={{ opacity: 0, transition: exit }}
                      className="pointer-events-none fixed z-[60] min-w-36 rounded-xl bg-surface-raised px-3 py-2 text-xs"
                      style={{
                        left: tipAnchor.left,
                        top: tipAnchor.top,
                        transform: tipAnchor.center
                          ? "translateX(-50%)"
                          : undefined,
                        transformOrigin: "top center",
                      }}
                    >
                      {tooltip}
                    </m.div>
                  )}
                </AnimatePresence>,
                portalHost,
              )}
          </Container>

          {interactive && (
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">{donut ? "Série" : "Período"}</th>
                  {donut ? (
                    <th scope="col">Total</th>
                  ) : (
                    visible.map((s) => (
                      <th key={s.id} scope="col">
                        {s.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {donut
                  ? visible.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">{s.label}</th>
                        <td>{spoken(sum(s.values))}</td>
                      </tr>
                    ))
                  : data.labels.map((label, i) => (
                      <tr key={`${label}-${i}`}>
                        <th scope="row">{label}</th>
                        {visible.map((s) => (
                          <td key={s.id}>{spoken(s.values[i] ?? 0)}</td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
          {interactive && (
            <p role="status" aria-live="polite" className="sr-only">
              {fromKeyboard && activeIndex !== null
                ? donut
                  ? `${visible[activeIndex]?.label}: ${spoken(sum(visible[activeIndex]?.values ?? []))}`
                  : `${data.labels[activeIndex]}: ${visible.map((s) => `${s.label} ${spoken(s.values[activeIndex] ?? 0)}`).join(", ")}`
                : ""}
            </p>
          )}
        </Container>
      </Container>
    </MotionConfig>
  );
}

const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);

function TooltipRows({
  title,
  rows,
}: {
  title?: string;
  rows: { color?: string; label: string; value: string }[];
}) {
  return (
    <>
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((row) => (
        <p
          key={row.label}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-[2px]"
            style={{ background: row.color }}
          />
          <span className="flex-1">{row.label}</span>
          <span className="amount font-mono text-foreground tabular-nums">
            {row.value}
          </span>
        </p>
      ))}
    </>
  );
}

function Donut({
  series,
  width,
  activeIndex,
  instant,
  onHover,
  format,
  height,
  showValue,
  onActivate,
}: {
  height: number;
  showValue: boolean;
  onActivate?: (index: number) => void;
  format: (value: number) => string;
  series: (ChartSeries & { color: string })[];
  width: number;
  activeIndex: number | null;
  instant: boolean;
  onHover: (index: number) => void;
}) {
  const total = sum(series.map((s) => sum(s.values))) || 1;
  const r = Math.max(1, Math.min(width, height) * 0.35);
  const c = 2 * Math.PI * r;
  const gap = series.length > 1 ? 2 : 0;
  const starts = series.map((_, i) =>
    series.slice(0, i).reduce((n, s) => n + (sum(s.values) / total) * c, 0),
  );

  return (
    <g>
      {showValue && (
        <text
          x={width / 2}
          y={height / 2 - 6}
          textAnchor="middle"
          fontSize="11"
          className="fill-muted-foreground"
        >
          {activeIndex === null ? "Total" : series[activeIndex]?.label}
        </text>
      )}
      {showValue && (
        <text
          x={width / 2}
          y={height / 2 + 16}
          textAnchor="middle"
          fontSize="18"
          fontWeight={500}
          className="amount fill-foreground tabular-nums"
        >
          {activeIndex === null
            ? format(total)
            : format(sum(series[activeIndex]?.values ?? []))}
        </text>
      )}
      <g transform={`translate(${width / 2}, ${height / 2}) rotate(-90)`}>
        {series.map((s, i) => {
          const share = sum(s.values) / total;
          const length = Math.max(share * c - gap, 0);
          const start = starts[i];
          return (
            <m.circle
              key={s.id}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={activeIndex === i ? r * 0.26 : r * 0.22}
              strokeDashoffset={-start}
              initial={instant ? false : { strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${length} ${c}` }}
              transition={
                instant
                  ? { duration: 0 }
                  : { duration: 0.6, ease: EASE_OUT, delay: i * 0.06 }
              }
              style={{ transition: "stroke-width 150ms ease-out" }}
              onPointerEnter={() => onHover(i)}
              onClick={() => onActivate?.(i)}
            />
          );
        })}
      </g>
    </g>
  );
}
