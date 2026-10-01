export function fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h };
  const s = maxEdge / edge;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}
