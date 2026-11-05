import { useContext, useMemo } from 'react';
import { Star, X } from 'lucide-react';
import type { DesignInput } from '../core/calculationEngine';
import { heightSweep, optimize, type CostUnitRates, type OptimizationCandidate, type SweepPoint } from '../core/costOptimizer';
import { fmt, money as formatMoney, urColor } from '../core/format';
import { gradeOf } from '../core/presets';
import { LangContext, useT, type Key } from '../i18n';
import { Group } from './InputPanel';

function useMoney() {
  const { lang } = useContext(LangContext);
  return (v: number, sign = false) => formatMoney(v, lang, sign);
}

function StrategyCard({ c, index, onPreview, onApply }: {
  c: OptimizationCandidate;
  index: number;
  onPreview: (input: DesignInput | null) => void;
  onApply: (c: OptimizationCandidate) => void;
}) {
  const t = useT();
  const money = useMoney();
  const p = c.proposedChanges;
  const m = c.metrics;
  const preview = c.feasible ? () => onPreview(c.input) : undefined;
  return (
    <div className={`card p-2.5 transition-colors ${c.feasible ? 'hover:border-accent' : 'opacity-80'}`}
      onMouseEnter={preview} onMouseLeave={() => onPreview(null)} onFocus={preview} onBlur={() => onPreview(null)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm">{index + 1}. {t(`s_${c.strategyType}` as Key)}</h3>
        {c.feasible && (
          <span className={`font-mono text-xs ${m.costDeltaVND > 0 ? 'text-warn' : 'text-ok'}`}>
            {m.costDeltaPercent > 0 ? '+' : ''}{fmt(m.costDeltaPercent, 1)}%
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{t(`d_${c.strategyType}` as Key)}</p>
      {c.feasible ? (
        <>
          <p className="mt-2 font-mono text-[11px] text-ink">
            h {p.h} · {p.concreteGrade} · {p.numLayers}×({p.legsPerLayerX}+{p.legsPerLayerY}) φ{p.barDiameter}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            θmin {fmt(m.minThetaDeg, 1)}° · <span style={{ color: urColor(m.maxCrushingUR) }}>UR,c {fmt(m.maxCrushingUR, 2)}</span> ·{' '}
            <span style={{ color: urColor(m.maxBurstingUR) }}>UR,b {fmt(m.maxBurstingUR, 2)}</span> · s_v {fmt(m.verticalSpacingSv, 0)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {money(m.totalCostVND)} ({money(m.costDeltaVND, true)}) · {fmt(m.burstingSteelMassKg, 0)} kg
          </p>
          <button className="btn btn-primary mt-2 w-full" onClick={() => onApply(c)}>{t('apply')}</button>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-bad">{t(`r_${c.infeasibleReason ?? 'NO_DESIGN'}` as Key)}</p>
      )}
    </div>
  );
}

const CHART = { w: 320, h: 170, l: 40, r: 8, t: 8, b: 22 };

function CostChart({ points, h0 }: { points: SweepPoint[]; h0: number }) {
  const t = useT();
  if (points.length < 2) return null;
  const { w, h, l, r, t: top, b } = CHART;
  const hMin = points[0].h;
  const hMax = points[points.length - 1].h;
  const yMax = Math.max(...points.map((p) => p.total)) * 1.08;
  const X = (v: number) => l + ((v - hMin) / (hMax - hMin)) * (w - l - r);
  const Y = (v: number) => h - b - (v / yMax) * (h - top - b);
  const path = (k: 'concreteFormExc' | 'steel' | 'total') => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.h)},${Y(p[k])}`).join('');
  const feasible = points.filter((p) => p.feasible);
  const best = feasible.length ? feasible.reduce((a, p) => (p.total < a.total ? p : a)) : null;
  const step = (hMax - hMin) / (points.length - 1);
  const lines: Array<['concreteFormExc' | 'steel' | 'total', string, Key]> = [
    ['concreteFormExc', '#3b82f6', 'legendConcrete'],
    ['steel', '#f97316', 'legendSteel'],
    ['total', '#10b981', 'legendTotal'],
  ];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full font-mono" role="img" aria-label={t('chartTitle')}>
        <defs>
          <pattern id="crush-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#ef4444" strokeOpacity="0.45" strokeWidth="2" />
          </pattern>
        </defs>
        {points.filter((p) => p.crushing).map((p) => (
          <rect key={p.h} x={Math.max(l, X(p.h - step / 2))} y={top} height={h - top - b}
            width={Math.min(X(p.h + step / 2), w - r) - Math.max(l, X(p.h - step / 2))} fill="url(#crush-hatch)" />
        ))}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={l} x2={w - r} y1={Y(yMax * f)} y2={Y(yMax * f)} stroke="var(--p-line)" />
            <text x={l - 4} y={Y(yMax * f) + 3} textAnchor="end" fontSize="8" fill="var(--p-muted)">{fmt((yMax * f) / 1e6, 0)}</text>
          </g>
        ))}
        {points.filter((_, i) => i % 2 === 0).map((p) => (
          <text key={p.h} x={X(p.h)} y={h - 8} textAnchor="middle" fontSize="8" fill="var(--p-muted)">{p.h}</text>
        ))}
        <line x1={X(h0)} x2={X(h0)} y1={top} y2={h - b} stroke="var(--p-muted)" strokeDasharray="3 3" />
        {lines.map(([k, color]) => <path key={k} d={path(k)} fill="none" stroke={color} strokeWidth={k === 'total' ? 2 : 1.5} />)}
        {best && (
          <g transform={`translate(${X(best.h)},${Y(best.total)})`}>
            <Star x={-7} y={-7} width={14} height={14} fill="#fbbf24" stroke="#fbbf24" />
          </g>
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {lines.map(([k, color, label]) => (
          <span key={k} className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ background: color }} />{t(label)}</span>
        ))}
        <span className="inline-flex items-center gap-1"><i className="hatch-crush inline-block h-2 w-3 border border-bad/50" />{t('crushZone')}</span>
        <span>h (mm) · {t('legendUnit')}</span>
      </figcaption>
    </figure>
  );
}

const RATE_FIELDS: Array<[Exclude<keyof CostUnitRates, 'concretePricePerM3'>, Key]> = [
  ['rebarPricePerKg', 'rRebar'],
  ['formworkPricePerM2', 'rFormwork'],
  ['excavationPricePerM3', 'rExcavation'],
];

export default function AutoFixPanel({ input, rates, onRatesChange, onPreview, onApply, onClose }: {
  input: DesignInput;
  rates: CostUnitRates;
  onRatesChange: (r: CostUnitRates) => void;
  onPreview: (input: DesignInput | null) => void;
  onApply: (c: OptimizationCandidate) => void;
  onClose: () => void;
}) {
  const t = useT();
  const candidates = useMemo(() => optimize(input, rates), [input, rates]);
  const global = candidates[2];
  const sweepMaterial = global.feasible ? global.input.material : input.material;
  const sweep = useMemo(() => heightSweep({ ...input, material: sweepMaterial }, rates), [input, sweepMaterial, rates]);
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line p-3">
        <h2 className="text-sm">{t('autoFix')}</h2>
        <button className="btn" onClick={onClose} aria-label={t('close')}><X size={14} /></button>
      </div>
      <Group title={t('strategies')}>
        <div className="flex flex-col gap-2">
          {candidates.map((c, i) => <StrategyCard key={c.strategyType} c={c} index={i} onPreview={onPreview} onApply={onApply} />)}
        </div>
      </Group>
      <Group title={`${t('chartTitle')} · ${gradeOf(sweepMaterial.fcd).id}`}>
        <CostChart points={sweep} h0={input.geometry.h} />
      </Group>
      <Group title={t('rates')}>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(rates.concretePricePerM3).map(([grade, v]) => (
            <label key={grade} className="field">
              {grade} (đ/m³)
              <input className="input" type="number" step={10000} value={v}
                onChange={(e) => onRatesChange({ ...rates, concretePricePerM3: { ...rates.concretePricePerM3, [grade]: num(e.target.value) } })} />
            </label>
          ))}
          {RATE_FIELDS.map(([k, label]) => (
            <label key={k} className="field">
              {t(label)}
              <input className="input" type="number" step={1000} value={rates[k]} onChange={(e) => onRatesChange({ ...rates, [k]: num(e.target.value) })} />
            </label>
          ))}
        </div>
      </Group>
    </div>
  );
}
