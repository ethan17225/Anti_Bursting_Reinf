export const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : '–');

export const urColor = (ur: number) => (ur > 1 ? 'var(--color-bad)' : ur > 0.75 ? 'var(--color-warn)' : 'var(--color-ok)');
