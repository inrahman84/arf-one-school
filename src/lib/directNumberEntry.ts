/** Keep numeric form editing independent from browser number spinners and localized grouping. */
export function sanitizeDirectNumber(raw: string, allowDecimal = false): string {
  if (!allowDecimal) return raw.replace(/\D/g, '').slice(0, 15);
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const dot = cleaned.indexOf('.');
  return (dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')).slice(0, 20);
}

export function parseDirectNumber(raw: string): number | null {
  if (!raw || raw === '.') return 0;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : null;
}

export function formatDirectNumber(value: number, currency = false): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return currency ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) : String(value);
}
