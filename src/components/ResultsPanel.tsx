import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Printer, XCircle } from 'lucide-react';
import type { DesignInput, DesignResult } from '../core/calculationEngine';
import type { FormulaId } from '../core/formulas';
import { useT, type Key } from '../i18n';
import { fmt, urColor } from '../core/format';
import FormulaButton from './FormulaButton';
import { Group } from './InputPanel';

function Badge({ ok }: { ok: boolean }) {
  const t = useT();
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-white ${ok ? 'bg-ok' : 'bg-bad'}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {t(ok ? 'pass' : 'fail')}
    </span>
  );
}

function Bar({ ur, faded }: { ur: number; faded?: boolean }) {
  return (
    <div className={`mt-1.5 flex items-center gap-2 ${faded ? 'opacity-35' : ''}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface">
        <div className="h-full transition-[width] duration-300" style={{ width: `${Math.min(ur, 1) * 100}%`, background: urColor(ur) }} />
      </div>
      <span className="w-9 text-right font-mono text-[10px]" style={{ color: urColor(ur) }}>{fmt(ur, 2)}</span>
    </div>
  );
}

function Check({ title, formula, ok, detail, ur, oldUr }: { title: string; formula?: ReactNode; ok: boolean; detail: string; ur?: number; oldUr?: number }) {
  return (
    <div className={`card p-2.5 ${ok ? '' : 'glow-bad'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium">{title}{formula}</span>
        <Badge ok={ok} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted">{detail}</p>
      {ur !== undefined && oldUr !== undefined && <Bar ur={oldUr} faded />}
      {ur !== undefined && <Bar ur={ur} />}
    </div>
  );
}

const strutStats = (r: DesignResult) => {
  const active = r.piles.filter((p) => p.active);
  return {
    thetaMin: active.length ? Math.min(...active.map((p) => p.theta)) : 90,
    crushMax: active.length ? Math.max(...active.map((p) => p.URcrush)) : 0,
    sigmaMax: active.length ? Math.max(...active.map((p) => p.sigma)) : 0,
  };
};

const COLS: Array<[string, FormulaId | null]> = [
  ['', null], ['R kN', 'R'], ['a mm', 'a'], ['θ°', 'theta'], ['Fc kN', 'Fc'], ['T⊥ kN', 'Tperp'], ['Tx kN', 'Tx'], ['Ty kN', 'Ty'],
];

export default function ResultsPanel({ input, result: r, baseline, selectedPileId, onSelectPile, onPrint }: {
  input: DesignInput;
  result: DesignResult;
  baseline?: DesignResult;
  selectedPileId: number | null;
  onSelectPile: (id: number) => void;
  onPrint: () => void;
}) {
  const t = useT();
  const { thetaMin, crushMax, sigmaMax } = strutStats(r);
  const old = baseline && strutStats(baseline);
  const active = r.piles.filter((p) => p.active);
  const thetaPile = active.reduce((a, p) => (p.theta < a.theta ? p : a), active[0]);
  const crushPile = active.reduce((a, p) => (p.URcrush > a.URcrush ? p : a), active[0]);
  const shown = r.piles.find((p) => p.id === selectedPileId) ?? active[0] ?? r.piles[0];
  const f = (id: FormulaId, pileId?: number) => <FormulaButton input={input} result={r} id={id} pileId={pileId} />;

  return (
    <div>
      <Group title={t('results')} tour="results">
        <div className="flex flex-col gap-2">
          <Check title={t('checkTheta')} formula={thetaPile && f('theta', thetaPile.id)} ok={thetaMin >= 25} detail={`θmin = ${fmt(thetaMin, 2)}° ≥ 25°`} />
          <Check title={t('checkCrush')} formula={crushPile && f('crush', crushPile.id)} ok={crushMax <= 1} ur={crushMax} oldUr={old?.crushMax}
            detail={`σc = ${fmt(sigmaMax, 2)} / σRd,max = ${fmt(r.sigmaRdMax, 2)} MPa (${fmt(crushMax * 100, 0)}%)`} />
          <Check title={t('checkBurstX')} formula={f('burstX')} ok={r.URX <= 1} ur={r.URX} oldUr={baseline?.URX}
            detail={`As,req ${fmt(r.AsReqX)} / As,prov ${fmt(r.AsProvX)} mm² (${fmt(r.URX * 100)}%)`} />
          <Check title={t('checkBurstY')} formula={f('burstY')} ok={r.URY <= 1} ur={r.URY} oldUr={baseline?.URY}
            detail={`As,req ${fmt(r.AsReqY)} / As,prov ${fmt(r.AsProvY)} mm² (${fmt(r.URY * 100)}%)`} />
        </div>
      </Group>

      {r.warnings.length > 0 && (
        <Group title={t('warnings')}>
          <ul className="flex flex-col gap-1.5">
            {r.warnings.map((w, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-bad">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>{w.pileId ? `P${w.pileId}: ` : ''}{t(`w_${w.code}` as Key)}{w.code === 'SV_RANGE' ? ` (s_v = ${fmt(r.sv, 0)} mm)` : ''}</span>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title={t('perPile')}>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="text-muted">
              <tr className="text-right">
                {COLS.map(([label, id]) => (
                  <th key={label} className="px-1 py-1 font-normal first:text-left">
                    <span className="inline-flex items-center gap-0.5 first:justify-start">{label}{id && shown && f(id, shown.id)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.piles.map((p) => (
                <tr key={p.id} onClick={() => onSelectPile(p.id)}
                  className={`cursor-pointer border-t border-line text-right transition-colors hover:bg-surface ${selectedPileId === p.id ? 'bg-surface outline outline-1 outline-accent' : ''} ${p.active ? '' : 'text-muted'}`}>
                  <td className="px-1 py-1.5 text-left" style={{ color: p.active ? urColor(p.URcrush) : undefined }}>P{p.id}</td>
                  <td className="px-1">{fmt(p.R)}</td>
                  <td className="px-1">{fmt(p.a, 0)}</td>
                  <td className="px-1">{fmt(p.theta, 2)}</td>
                  <td className="px-1">{fmt(p.Fc)}</td>
                  <td className="px-1">{fmt(p.Tperp)}</td>
                  <td className="px-1">{fmt(p.Tx)}</td>
                  <td className="px-1">{fmt(p.Ty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <span className="inline-flex items-center gap-0.5">d = {fmt(r.d, 0)} {f('d')}</span>
          <span className="inline-flex items-center gap-0.5">z = {fmt(r.z)} {f('z')}</span>
          <span className="inline-flex items-center gap-0.5">T,X = {fmt(r.TdesignX)} kN {f('TdesignX')}</span>
          <span className="inline-flex items-center gap-0.5">T,Y = {fmt(r.TdesignY)} kN {f('TdesignY')}</span>
        </p>
      </Group>

      <div className="p-3">
        <button data-tour="print" className="btn btn-primary w-full py-2" onClick={onPrint}>
          <Printer size={14} /> {t('print')}
        </button>
      </div>
    </div>
  );
}
