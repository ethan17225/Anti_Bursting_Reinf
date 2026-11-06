import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import type { DesignInput, DesignResult } from '../core/calculationEngine';
import { explain, type FormulaId } from '../core/formulas';
import { useT } from '../i18n';

export default function FormulaButton({ input, result, id, pileId }: {
  input: DesignInput;
  result: DesignResult;
  id: FormulaId;
  pileId?: number | null;
}) {
  const t = useT();
  const own = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ left: 0, top: 0, above: false });
  const e = explain(id, input, result, pileId);

  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent('formula-open', { detail: own }));
  }, [open, own]);

  useEffect(() => {
    const close = (ev: Event) => {
      if ((ev as CustomEvent<string>).detail !== own) setOpen(false);
    };
    window.addEventListener('formula-open', close);
    return () => window.removeEventListener('formula-open', close);
  }, [own]);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const width = 308;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - r.bottom;
      setBox({ left, top: spaceBelow < 250 && r.top > spaceBelow ? r.top - 8 : r.bottom + 8, above: spaceBelow < 250 && r.top > spaceBelow });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    const onDown = (ev: MouseEvent) => {
      const node = ev.target as Node;
      if (!btn.current?.contains(node) && !document.getElementById(own)?.contains(node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, own]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
        aria-expanded={open}
        aria-label={`${t('f_formula')}: ${t(e.title)}`}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Info size={10} />
      </button>
      {open && createPortal(
        <div id={own} role="dialog" aria-label={t(e.title)}
          className="fixed z-[70] w-[308px] rounded-md border border-line bg-panel p-3 shadow-xl"
          style={{ left: box.left, top: box.top, transform: box.above ? 'translateY(-100%)' : undefined }}>
          <p className="label">{e.symbol}{e.pile ? ` · ${e.pile}` : ''}</p>
          <h3 className="mt-0.5 text-sm">{t(e.title)}</h3>
          {e.lines.map((line, i) => <p key={i} className="mt-1.5 break-words font-mono text-[11px] leading-relaxed">{line}</p>)}
          <p className="mt-2 font-mono text-xs text-accent">{e.value}</p>
          {e.foot && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t(e.foot)}</p>}
        </div>,
        document.body,
      )}
    </>
  );
}
