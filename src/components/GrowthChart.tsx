import { useMemo, useState } from "react";
import {
  BOY_HEIGHT_STANDARDS,
  BOY_WEIGHT_STANDARDS,
  GIRL_HEIGHT_STANDARDS,
  GIRL_WEIGHT_STANDARDS,
  type GrowthPoint,
} from "@/data/growthStandards";
import type { GrowthRecord, Sex } from "@/types";

interface Props {
  records: GrowthRecord[];
  sex?: Sex;
}

export default function GrowthChart({ records, sex = "M" }: Props) {
  const [metric, setMetric] = useState<"weight" | "height">("weight");

  const standards: GrowthPoint[] = useMemo(() => {
    if (metric === "weight") {
      return sex === "F" ? GIRL_WEIGHT_STANDARDS : BOY_WEIGHT_STANDARDS;
    }
    return sex === "F" ? GIRL_HEIGHT_STANDARDS : BOY_HEIGHT_STANDARDS;
  }, [metric, sex]);

  // กรองเฉพาะบันทึกที่มีค่านั้นๆ และเรียงตามอายุ
  const points = useMemo(() => {
    return records
      .filter((r) => (metric === "weight" ? r.weightKg != null : r.heightCm != null))
      .map((r) => ({
        month: r.ageMonths,
        val: metric === "weight" ? r.weightKg! : r.heightCm!,
        date: r.date,
      }))
      .sort((a, b) => a.month - b.month);
  }, [records, metric]);

  const maxMonth = 60; // 5 ขวบ
  const maxVal = metric === "weight" ? 26 : 125;
  const minVal = metric === "weight" ? 2 : 40;

  const width = 360;
  const height = 220;
  const padL = 35;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const getX = (m: number) => padL + (Math.min(maxMonth, m) / maxMonth) * chartW;
  const getY = (v: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, v));
    const r = (clamped - minVal) / (maxVal - minVal);
    return height - padB - r * chartH;
  };

  // สร้าง path แถบเกณฑ์มาตรฐาน (P3 ถึง P97)
  const areaP3P97 = useMemo(() => {
    const top = standards.map((s) => `${getX(s.month)},${getY(s.p97)}`);
    const btm = [...standards].reverse().map((s) => `${getX(s.month)},${getY(s.p3)}`);
    return [...top, ...btm].join(" ");
  }, [standards, metric]);

  // เส้น Median (P50)
  const medianLine = useMemo(() => {
    return standards.map((s) => `${getX(s.month)},${getY(s.p50)}`).join(" ");
  }, [standards, metric]);

  // เส้นของลูก
  const childLine = useMemo(() => {
    return points.map((p) => `${getX(p.month)},${getY(p.val)}`).join(" ");
  }, [points]);

  return (
    <div className="space-y-3">
      {/* สลับแท็บ น้ำหนัก / ส่วนสูง */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setMetric("weight")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
            metric === "weight"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/40 text-muted-foreground border-input hover:bg-muted"
          }`}
        >
          ⚖️ กราฟน้ำหนัก (กก.)
        </button>
        <button
          type="button"
          onClick={() => setMetric("height")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
            metric === "height"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/40 text-muted-foreground border-input hover:bg-muted"
          }`}
        >
          📏 กราฟส่วนสูง (ซม.)
        </button>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 overflow-visible select-none"
          role="img"
          aria-label={`กราฟ${metric === "weight" ? "น้ำหนัก" : "ส่วนสูง"}ตามเกณฑ์อายุ`}
        >
          {/* แถบเกณฑ์ปกติ P3 ถึง P97 */}
          <polygon points={areaP3P97} fill="#10b981" fillOpacity="0.12" />

          {/* เส้น Median P50 */}
          <polyline
            points={medianLine}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.8"
          />

          {/* Grid lines แกนอายุ (0, 1, 2, 3, 4, 5 ปี) */}
          {[0, 12, 24, 36, 48, 60].map((m) => {
            const x = getX(m);
            return (
              <g key={m}>
                <line x1={x} y1={padT} x2={x} y2={height - padB} stroke="currentColor" strokeOpacity="0.1" />
                <text x={x} y={height - padB + 14} fontSize="8.5" textAnchor="middle" fill="currentColor" className="fill-muted-foreground">
                  {m === 0 ? "แรกเกิด" : `${m / 12} ขวบ`}
                </text>
              </g>
            );
          })}

          {/* Grid lines แกน Y */}
          {(metric === "weight" ? [5, 10, 15, 20, 25] : [50, 70, 90, 110]).map((v) => {
            const y = getY(v);
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="currentColor" strokeOpacity="0.1" />
                <text x={padL - 5} y={y + 3} fontSize="8.5" textAnchor="end" fill="currentColor" className="fill-muted-foreground">
                  {v}
                </text>
              </g>
            );
          })}

          {/* เส้นแนวโน้มของลูก */}
          {points.length > 1 && (
            <polyline
              points={childLine}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* จุดข้อมูลของลูก */}
          {points.map((p, i) => {
            const cx = getX(p.month);
            const cy = getY(p.val);
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                <text
                  x={cx}
                  y={cy - 7}
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="fill-foreground"
                >
                  {p.val}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between pt-2 border-t mt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> ข้อมูลของลูก
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded bg-emerald-500/20 border border-emerald-500/40" /> เกณฑ์มาตรฐานกรมอนามัย
          </span>
        </div>
      </div>
    </div>
  );
}
