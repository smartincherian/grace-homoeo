/** Newest visit time (createdAt, falling back to date for legacy visits); null if none. */
export function latestVisitAt(
  visits: { createdAt?: number | null; date?: number | null }[],
): number | null {
  let max: number | null = null;
  for (const v of visits) {
    const t = v.createdAt ?? v.date;
    if (
      typeof t === "number" &&
      Number.isFinite(t) &&
      (max === null || t > max)
    )
      max = t;
  }
  return max;
}
