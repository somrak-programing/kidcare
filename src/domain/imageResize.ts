export function fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number } {
  if (![w, h, maxEdge].every((n) => Number.isFinite(n) && n > 0)) return { w: 1, h: 1 };
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h };
  const s = maxEdge / edge;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}
