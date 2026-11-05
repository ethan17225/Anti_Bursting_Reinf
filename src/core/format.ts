export const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : '–');

export const money = (v: number, lang: 'vi' | 'en', sign = false) =>
  `${sign && v > 0 ? '+' : ''}${fmt(v / 1e6, 1)} ${lang === 'vi' ? 'tr đ' : 'M VND'}`;

export const urColor = (ur: number) => (ur > 1 ? 'var(--color-bad)' : ur > 0.85 ? 'var(--color-warn)' : 'var(--color-ok)');
