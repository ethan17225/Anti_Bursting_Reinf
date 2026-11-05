import type { ReactNode } from 'react';
import type { DesignInput, MaterialInput } from '../core/calculationEngine';
import { BAR_DIAMETERS, CONCRETE_GRADES, LAYOUTS, LEG_COUNTS, STEEL_GRADES, layoutGeometry, type LayoutId } from '../core/presets';
import { useT, type Key } from '../i18n';

const STANDARDS: Array<[MaterialInput['standard'], string]> = [
  ['EC2', 'EC2'],
  ['TCVN_5574_2018', 'TCVN 5574:2018'],
  ['ACI_318_19', 'ACI 318-19'],
];

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line p-3 last:border-b-0">
      <h2 className="label mb-2">{title}</h2>
      {children}
    </section>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="field">
      {label}
      <input
        className="input"
        type="number"
        step={step}
        value={value}
        onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Slider({ label, value, display, min, max, onChange }: { label: string; value: number; display: ReactNode; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="flex justify-between">
        {label} <span className="font-mono text-ink">{display}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function InputPanel({ input, onChange }: { input: DesignInput; onChange: (i: DesignInput) => void }) {
  const t = useT();
  const { material, geometry, load, detailing } = input;
  const setMaterial = (m: Partial<DesignInput['material']>) => onChange({ ...input, material: { ...material, ...m } });
  const setGeometry = (g: Partial<DesignInput['geometry']>) => onChange({ ...input, geometry: { ...geometry, ...g } });
  const setLoad = (l: Partial<DesignInput['load']>) => onChange({ ...input, load: { ...load, ...l } });
  const setDetailing = (d: Partial<DesignInput['detailing']>) => onChange({ ...input, detailing: { ...detailing, ...d } });
  const grade = CONCRETE_GRADES.find((g) => g.fck === material.fck && g.fcd === material.fcd)?.id ?? '';
  const steel = STEEL_GRADES.find((s) => s.fyd === material.fyd)?.id ?? '';

  return (
    <div>
      <Group title={t('presets')}>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYOUTS.map((id: LayoutId) => (
            <button key={id} className="btn" onClick={() => setGeometry(layoutGeometry(id, geometry.Dp))}>
              {t(id)}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t('material')}>
        <div className="grid grid-cols-3 gap-2">
          <label className="field">
            {t('standard')}
            <select className="input" value={material.standard} onChange={(e) => setMaterial({ standard: e.target.value as MaterialInput['standard'] })}>
              {STANDARDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">
            {t('concrete')}
            <select className="input" value={grade} onChange={(e) => {
              const g = CONCRETE_GRADES.find((x) => x.id === e.target.value)!;
              setMaterial({ fck: g.fck, fcd: g.fcd });
            }}>
              {CONCRETE_GRADES.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
            </select>
          </label>
          <label className="field">
            {t('steel')}
            <select className="input" value={steel} onChange={(e) => {
              const s = STEEL_GRADES.find((x) => x.id === e.target.value)!;
              setMaterial({ fyk: s.fyk, fyd: s.fyd });
            }}>
              {STEEL_GRADES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted">
          fck {material.fck} · fcd {material.fcd} · fyk {material.fyk} · fyd {material.fyd} MPa
        </p>
      </Group>

      <Group title={t('geometry')}>
        <div className="grid grid-cols-3 gap-2">
          {(['Lx', 'Ly', 'h', 'c', 'bc', 'hc', 'Dp'] as const).map((k) => (
            <NumField key={k} label={t(k as Key)} value={geometry[k]} step={50} onChange={(v) => setGeometry({ [k]: v })} />
          ))}
          <label className="field">
            {t('pileShape')}
            <select className="input" value={geometry.pileShape} onChange={(e) => setGeometry({ pileShape: e.target.value as 'CIRCULAR' | 'SQUARE' })}>
              <option value="CIRCULAR">{t('CIRCULAR')}</option>
              <option value="SQUARE">{t('SQUARE')}</option>
            </select>
          </label>
        </div>
        <p className="label mt-3 mb-1">{t('pilesCoords')}</p>
        <div className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1.5">
          {geometry.piles.map((p, i) => (
            <PileRow key={p.id} id={p.id} x={p.x} y={p.y} onChange={(x, y) => {
              const piles = geometry.piles.slice();
              piles[i] = { ...p, x, y };
              setGeometry({ piles });
            }} />
          ))}
        </div>
      </Group>

      <Group title={t('loads')}>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="NEd (kN)" value={load.NEd} step={100} onChange={(v) => setLoad({ NEd: v })} />
          <NumField label="MEd,x (kN·m)" value={load.MEdx} step={50} onChange={(v) => setLoad({ MEdx: v })} />
          <NumField label="MEd,y (kN·m)" value={load.MEdy} step={50} onChange={(v) => setLoad({ MEdy: v })} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={load.includeSelfWeight} onChange={(e) => setLoad({ includeSelfWeight: e.target.checked })} />
          {t('selfWeight')}
        </label>
      </Group>

      <Group title={t('detailing')}>
        <div className="flex flex-col gap-3">
          <Slider label={t('barDiameter')} min={0} max={BAR_DIAMETERS.length - 1} value={BAR_DIAMETERS.indexOf(detailing.barDiameter)}
            display={`φ${detailing.barDiameter}`} onChange={(i) => setDetailing({ barDiameter: BAR_DIAMETERS[i] })} />
          <Slider label={t('numLayers')} min={2} max={10} value={detailing.numLayers}
            display={detailing.numLayers} onChange={(v) => setDetailing({ numLayers: v })} />
          <Slider label={t('legsX')} min={0} max={LEG_COUNTS.length - 1} value={LEG_COUNTS.indexOf(detailing.legsPerLayerX)}
            display={detailing.legsPerLayerX} onChange={(i) => setDetailing({ legsPerLayerX: LEG_COUNTS[i] })} />
          <Slider label={t('legsY')} min={0} max={LEG_COUNTS.length - 1} value={LEG_COUNTS.indexOf(detailing.legsPerLayerY)}
            display={detailing.legsPerLayerY} onChange={(i) => setDetailing({ legsPerLayerY: LEG_COUNTS[i] })} />
        </div>
      </Group>
    </div>
  );
}

function PileRow({ id, x, y, onChange }: { id: number; x: number; y: number; onChange: (x: number, y: number) => void }) {
  return (
    <>
      <span className="font-mono text-xs text-muted">P{id}</span>
      <input className="input" type="number" step={50} aria-label={`P${id} x`} value={x} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value), y)} />
      <input className="input" type="number" step={50} aria-label={`P${id} y`} value={y} onChange={(e) => e.target.value !== '' && onChange(x, Number(e.target.value))} />
    </>
  );
}
