import { useEffect, useLayoutEffect, useState } from 'react';
import { useT, type Key } from '../i18n';

const STEPS = ['welcome', 'presets', 'inputs', 'detailing', 'viewer', 'tabs', 'results', 'autofix', 'cloud', 'print', 'prefs', 'hotkeys'] as const;
type Step = (typeof STEPS)[number];

const PAD = 6;
const CARD_W = 340;
const CARD_H = 250; // tallest card with its longest text, plus margin

const target = (s: Step) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${s}"]`);
  return el && el.getClientRects().length > 0 ? el : null;
};

export default function Tour({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [steps] = useState(() => STEPS.filter((s) => s === 'welcome' || target(s)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useLayoutEffect(() => {
    const el = step === 'welcome' ? null : target(step);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useEffect(() => {
    // Capture phase on window runs before the app's hotkeys, so they stay quiet during the tour.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); if (last) onClose(); else setI(i + 1); }
      else if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [i, last, onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  let style: React.CSSProperties;
  if (!rect) style = { left: (vw - w) / 2, top: vh / 2, transform: 'translateY(-50%)' };
  else {
    const left = Math.min(Math.max(12, rect.left), vw - w - 12);
    const gap = PAD + 10;
    if (vh - rect.bottom >= CARD_H) style = { left, top: rect.bottom + gap };
    else if (rect.top >= CARD_H) style = { left, bottom: vh - rect.top + gap };
    else style = { left: Math.min(Math.max(12, rect.left + gap), vw - w - 12), bottom: Math.max(12, vh - rect.bottom + gap) };
  }

  return (
    <div className="no-print fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="pointer-events-none fixed rounded-md border-2 border-accent transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD, boxShadow: '0 0 0 9999px rgba(2, 6, 15, 0.62)' }} />
      ) : (
        <div className="fixed inset-0 bg-[rgba(2,6,15,0.62)]" />
      )}
      <div className="card fixed p-4 shadow-xl" style={{ ...style, width: w }}>
        <p className="label">{i + 1} / {steps.length}</p>
        <h2 id="tour-title" className="mt-1 text-base">{t(`tour_${step}_t` as Key)}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(`tour_${step}_b` as Key)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button className="btn border-transparent bg-transparent" onClick={onClose}>{t('tourSkip')}</button>
          <div className="flex gap-1.5">
            {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>{t('tourBack')}</button>}
            <button className="btn btn-primary" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>
              {t(last ? 'tourDone' : 'tourNext')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
