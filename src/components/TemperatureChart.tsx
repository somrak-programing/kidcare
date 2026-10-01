import { useMemo } from "react";
import { Pill } from "lucide-react";
import type { TemperatureLog } from "@/types";

interface Props {
  logs: TemperatureLog[];
}

export default function TemperatureChart({ logs }: Props) {
  // เรียงจากเก่าไปใหม่สำหรับกราฟ
  const sorted = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
      .slice(-15); // แสดง 15 จุดล่าสุด
  }, [logs]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        ยังไม่มีบันทึกอุณหภูมิ
      </div>
    );
  }

  // กำหนดสเกลกราฟ
  const minTemp = 36.0;
  const maxTemp = 41.0;
  const height = 180;
  const width = 360;
  const padX = 35;
  const padY = 25;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const getY = (temp: number) => {
    const clamped = Math.max(minTemp, Math.min(maxTemp, temp));
    const ratio = (clamped - minTemp) / (maxTemp - minTemp);
    return height - padY - ratio * chartH;
  };

  const getX = (index: number) => {
    if (sorted.length <= 1) return width / 2;
    return padX + (index / (sorted.length - 1)) * chartW;
  };

  // เส้นไข้ 37.5 และ 38.5
  const normalY = getY(37.5);
  const highY = getY(38.5);

  const points = sorted.map((d, i) => `${getX(i)},${getY(d.tempCelsius)}`).join(" ");

  return (
    <div className="space-y-2">
      <div className="relative overflow-x-auto rounded-lg border bg-card p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible select-none"
          role="img"
          aria-label="กราฟอุณหภูมิร่างกาย"
        >
          {/* เส้น Grid แนวนอน & ป้าย */}
          <line x1={padX} y1={highY} x2={width - padX} y2={highY} stroke="#f43f5e" strokeDasharray="3 3" strokeOpacity="0.4" />
          <text x={padX - 5} y={highY + 3} textAnchor="end" fontSize="9" fill="#f43f5e" opacity="0.8">38.5°</text>

          <line x1={padX} y1={normalY} x2={width - padX} y2={normalY} stroke="#10b981" strokeDasharray="3 3" strokeOpacity="0.4" />
          <text x={padX - 5} y={normalY + 3} textAnchor="end" fontSize="9" fill="#10b981" opacity="0.8">37.5°</text>

          {/* เส้นกราฟ */}
          {sorted.length > 1 && (
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )}

          {/* จุดข้อมูล */}
          {sorted.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.tempCelsius);
            const isHigh = d.tempCelsius >= 38.5;
            const isLowFever = d.tempCelsius >= 37.5 && d.tempCelsius < 38.5;
            const fillColor = isHigh ? "#f43f5e" : isLowFever ? "#f59e0b" : "#10b981";

            const timeStr = new Date(d.measuredAt).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <g key={d.id} className="cursor-pointer group">
                <circle cx={cx} cy={cy} r="4.5" fill={fillColor} stroke="#ffffff" strokeWidth="1.5" />
                {d.gaveAntipyretic && (
                  <circle cx={cx} cy={cy - 10} r="3" fill="#8b5cf6" />
                )}
                <text
                  x={cx}
                  y={cy - 7}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="currentColor"
                  className="fill-foreground"
                >
                  {d.tempCelsius}
                </text>
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="8"
                  className="fill-muted-foreground"
                >
                  {timeStr}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t mt-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> ปกติ
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> ไข้ต่ำ
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> ไข้สูง
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" /> จุดที่ให้ยาลดไข้
          </span>
        </div>
      </div>
    </div>
  );
}
