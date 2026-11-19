/** D1 binds at most 100 parameters per statement: rows per insert for a width. */
export function chunks<T>(rows: T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(100 / columns));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
