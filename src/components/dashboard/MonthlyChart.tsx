import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { MonthBucket } from "@/domain/dashboard";
import { useDismissOnOutside } from "./useDismiss";

interface Kid {
  id: string;
  name: string;
  color: string;
}

const W = 360;
const H = 182;
const ML = 24;
const MR = 8;
const MT = 8;
const MB = 30;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const BASE_Y = MT + PLOT_H;
const MAX_BAR = 18;
const GAP = 2;

export function MonthlyChart({ buckets, kids }: { buckets: MonthBucket[]; kids: Kid[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [kbd, setKbd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useCallback(() => {
    setActive(null);
    setKbd(false);
  }, []);
  useDismissOnOutside(ref, clear, active !== null);

  const grand = buckets.reduce((s, b) => s + b.total, 0);
  const heading = <h3 className="text-sm font-semibold">นัดวัคซีนและนัดหมอ 12 เดือนข้างหน้า</h3>;

  if (grand === 0) {
    return (
      <div className="rounded-lg border bg-card p-3">
        {heading}
        <p className="mt-2 text-xs text-muted-foreground">ไม่มีนัดใน 12 เดือนข้างหน้า</p>
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  const y = (v: number) => BASE_Y - (v / max) * PLOT_H;
  const band = PLOT_W / Math.max(buckets.length, 1);
  const barW = Math.min(MAX_BAR, band * 0.6);

  const describe = (b: MonthBucket) => {
    const parts = kids.filter((k) => (b.counts[k.id] ?? 0) > 0).map((k) => `${k.name} ${b.counts[k.id]} นัด`);
    return parts.length ? parts.join(", ") : "ไม่มีนัด";
  };

  const activeBucket = active !== null ? buckets[active] : null;
  const tipStyle: CSSProperties = { top: `${(MT / H) * 100}%` };
  if (active !== null) {
    if (active < 6) tipStyle.left = `${((ML + (active + 1) * band) / W) * 100 + 1}%`;
    else tipStyle.right = `${100 - ((ML + active * band) / W) * 100 + 1}%`;
  }
  const chartLabel = `จำนวนนัดใน 12 เดือนข้างหน้า รวม ${grand} นัด`;

  return (
    <div className="rounded-lg border bg-card p-3">
      {heading}
      {kids.length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {kids.map((k) => (
            <span key={k.id} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-[10px] w-[10px] rounded-sm" style={{ backgroundColor: k.color }} aria-hidden="true" />
              {k.name}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative mt-2">
        {activeBucket && (
          <div
            className="pointer-events-none absolute z-10 max-w-[60%] rounded-md border bg-card px-2 py-1 text-xs text-foreground shadow-md"
            style={tipStyle}
          >
            <div className="truncate font-medium">
              {activeBucket.label} {activeBucket.yearBE}
            </div>
            {activeBucket.total === 0 ? (
              <div className="truncate text-muted-foreground">ไม่มีนัด</div>
            ) : (
              kids
                .filter((k) => (activeBucket.counts[k.id] ?? 0) > 0)
                .map((k) => (
                  <div key={k.id} className="truncate">
                    • {k.name} {activeBucket.counts[k.id]}
                  </div>
                ))
            )}
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="block"
          role="group"
          aria-label={chartLabel}
        >
          <g className="text-muted-foreground">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="currentColor" opacity={t === 0 ? 0.4 : 0.15} />
                <text x={ML - 4} y={y(t) + 3} textAnchor="end" fontSize={11} fill="currentColor">
                  {t}
                </text>
              </g>
            ))}
          </g>
          {buckets.map((b, i) => {
            const cx = ML + (i + 0.5) * band;
            let cum = 0;
            let first = true;
            const segs: JSX.Element[] = [];
            for (const k of kids) {
              const c = b.counts[k.id] ?? 0;
              if (c <= 0) continue;
              const top = y(cum + c);
              const bottom = y(cum) - (first ? 0 : GAP);
              const h = Math.max(1, bottom - top);
              segs.push(<rect key={k.id} x={cx - barW / 2} y={bottom - h} width={barW} height={h} rx={2} fill={k.color} />);
              cum += c;
              first = false;
            }
            const showYear = i === 0 || buckets[i - 1].yearBE !== b.yearBE;
            return (
              <g key={b.key}>
                {active === i && (
                  <rect
                    x={ML + i * band}
                    y={MT}
                    width={band}
                    height={PLOT_H}
                    fill="currentColor"
                    fillOpacity={0.08}
                    stroke={kbd ? "currentColor" : "none"}
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                )}
                {segs}
                <g className="text-muted-foreground">
                  <text x={cx} y={BASE_Y + 13} textAnchor="middle" fontSize={11} fill="currentColor">
                    {b.label}
                  </text>
                  {showYear && (
                    <text x={cx} y={BASE_Y + 25} textAnchor="middle" fontSize={10} fill="currentColor">
                      {b.yearBE}
                    </text>
                  )}
                </g>
                <rect
                  x={ML + i * band}
                  y={0}
                  width={band}
                  height={H}
                  fill="transparent"
                  tabIndex={0}
                  className="outline-none"
                  aria-label={`${b.label} ${b.yearBE}: ${describe(b)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={clear}
                  onPointerDown={() => {
                    setKbd(false);
                    setActive(i);
                  }}
                  onFocus={(e) => {
                    let visible = false;
                    try {
                      visible = e.currentTarget.matches(":focus-visible");
                    } catch {
                      visible = false;
                    }
                    setKbd(visible);
                    setActive(i);
                  }}
                  onBlur={clear}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <table className="sr-only">
        <caption>{chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">เดือน</th>
            {kids.map((k) => (
              <th key={k.id} scope="col">
                {k.name}
              </th>
            ))}
            <th scope="col">รวม</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <td>
                {b.label} {b.yearBE}
              </td>
              {kids.map((k) => (
                <td key={k.id}>{b.counts[k.id] ?? 0}</td>
              ))}
              <td>{b.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
