import type { ReactNode } from "react";
import { SkeletonBox } from "skullet/react";

function Line({
  width = "40%",
  height = 12,
}: {
  width?: string | number;
  height?: number;
}) {
  return <SkeletonBox width={width} height={height} radius="4px" />;
}

function CardShell({
  className,
  header,
  children,
}: {
  className: string;
  header?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`finance-card tuff-finance-shell ${className}`}>
      {header ? (
        <div data-slot="surface-header">
          <SkeletonBox width={30} height={30} radius="10px" />
          <Line width="42%" height={13} />
        </div>
      ) : null}
      <div className="tuff-finance-body">{children}</div>
    </div>
  );
}

/** Placeholder retangular no grid da visão geral. Sem anéis/donuts. */
export function ClaraViewSkeleton({ view }: { view: string }) {
  if (view !== "dashboard") {
    return (
      <div className="grid w-full gap-[18px]" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <Line width="28%" height={16} />
          <SkeletonBox width={96} height={32} radius="10px" />
        </div>
        <CardShell className="home-result" header>
          <div className="flex flex-col gap-4">
            <Line width="50%" height={28} />
            <SkeletonBox width="100%" height={180} radius="12px" />
          </div>
        </CardShell>
      </div>
    );
  }

  return (
    <div className="home-grid" aria-hidden="true">
      <div className="home-top-stack">
        <CardShell className="home-forecast">
          <div className="home-forecast-body">
            <div className="home-card-heading">
              <Line width="55%" height={11} />
              <SkeletonBox width={24} height={24} radius="6px" />
            </div>
            <div className="budget-overview">
              <SkeletonBox width="100%" height={150} radius="12px" />
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-3">
              <SkeletonBox width="100%" height={52} radius="12px" />
              <SkeletonBox width="100%" height={52} radius="12px" />
            </div>
          </div>
        </CardShell>
      </div>

      <CardShell className="home-distribution" header>
        <div className="home-distribution-body">
          <SkeletonBox
            className="shrink-0"
            width={240}
            height={240}
            radius="12px"
          />
          <div className="home-spending-list flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-3"
              >
                <SkeletonBox width={22} height={22} radius="6px" />
                <Line width="70%" height={12} />
                <Line width={36} height={10} />
                <Line width={56} height={12} />
              </div>
            ))}
          </div>
        </div>
      </CardShell>

      <div className="home-left-stack">
        <CardShell className="home-result" header>
          <div className="home-result-overview flex flex-col gap-2">
            <Line width="48%" height={28} />
            <Line width="38%" height={12} />
            <SkeletonBox width="100%" height={82} radius="10px" />
          </div>
          <div className="home-result-metrics">
            <div className="flex flex-col gap-2">
              <Line width="40%" height={10} />
              <Line width="70%" height={14} />
            </div>
            <div className="flex flex-col gap-2">
              <Line width="40%" height={10} />
              <Line width="70%" height={14} />
            </div>
          </div>
        </CardShell>
        <CardShell className="home-market" header>
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <SkeletonBox width={36} height={36} radius="10px" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Line width="55%" height={11} />
                  <Line width="35%" height={10} />
                </div>
                <Line width={64} height={14} />
              </div>
            ))}
          </div>
        </CardShell>
      </div>

      <div className="home-middle-stack">
        <CardShell className="home-investments" header>
          <div className="home-investment-categories">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="home-investment-category"
                style={{ pointerEvents: "none" }}
              >
                <SkeletonBox width={34} height={34} radius="10px" />
                <div className="home-investment-category-copy">
                  <Line width="48%" height={12} />
                  <Line width="32%" height={10} />
                </div>
                <Line width={54} height={12} />
              </div>
            ))}
          </div>
        </CardShell>
        <CardShell className="home-wealth" header>
          <div className="flex flex-col gap-2">
            <Line width="52%" height={28} />
          </div>
          <div className="home-wealth-chart">
            <SkeletonBox width="100%" height={125} radius="12px" />
          </div>
          <div className="home-card-footer">
            <Line width="78%" height={11} />
          </div>
        </CardShell>
      </div>

      <div className="home-right-stack">
        <CardShell className="home-cards" header>
          <div className="home-cards-top">
            <Line width="40%" height={12} />
            <div className="home-cards-amount-row">
              <Line width="56%" height={28} />
              <Line width={48} height={12} />
            </div>
            <SkeletonBox width={110} height={32} radius="10px" />
          </div>
          <SkeletonBox width="100%" height={88} radius="14px" />
          <div className="home-cards-entries flex flex-1 flex-col gap-2.5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <SkeletonBox width={32} height={32} radius="10px" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Line width="60%" height={11} />
                  <Line width="40%" height={10} />
                </div>
                <Line width={52} height={12} />
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
