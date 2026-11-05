import type { ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import type { DesignInput, DesignResult } from '../core/calculationEngine';
import { useT, type Key } from '../i18n';
import { fmt } from '../core/format';
import Section2D from './Section2D';

const ok = (pass: boolean) => (pass ? '✓ OK' : '✗ NG');

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h3 className="mb-1.5 border-b border-[#333231] pb-0.5 text-sm font-semibold">{title}</h3>
      <div className="flex flex-col gap-0.5 font-mono text-[11px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Report({ input, result: r, onClose }: { input: DesignInput; result: DesignResult; onClose: () => void }) {
  const t = useT();
  const { material: m, geometry: g, load: l, detailing: dt } = input;
  const active = r.piles.filter((p) => p.active);
  const p = active.reduce((a, b) => (b.Fc > a.Fc ? b : a), active[0] ?? r.piles[0]);
  const n = g.piles.length;
  const sumX2 = g.piles.reduce((s, q) => s + q.x * q.x, 0);
  const sumY2 = g.piles.reduce((s, q) => s + q.y * q.y, 0);
  const side = (pick: (q: (typeof r.piles)[number]) => [number, number]) =>
    r.piles.reduce(([pos, neg], q) => { const [c, v] = pick(q); return c >= 0 ? [pos + v, neg] : [pos, neg + v]; }, [0, 0]);
  const [xPos, xNeg] = side((q) => [q.x, q.Tx]);
  const [yPos, yNeg] = side((q) => [q.y, q.Ty]);
  const aci = m.standard === 'ACI_318_19';

  return (
    <div className="report fixed inset-0 z-50 overflow-auto bg-surface print:static print:overflow-visible print:bg-white">
      <div className="no-print sticky top-0 flex justify-end gap-2 border-b border-line bg-panel p-2">
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
        <button className="btn" onClick={onClose}><X size={14} /> {t('close')}</button>
      </div>
      <article className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[15mm] text-[#333231] shadow print:m-0 print:w-auto print:p-0 print:shadow-none">
        <h2 className="text-xl">{t('reportTitle')}</h2>
        <p className="font-mono text-[11px] text-muted">{m.standard.replace('_5574_', ' 5574:').replace('_318_', ' 318-')} · {new Date().toLocaleDateString()}</p>

        <Step title={t('inputs')}>
          <span>fck = {m.fck} MPa, fcd = {m.fcd} MPa, fyk = {m.fyk} MPa, fyd = {m.fyd} MPa</span>
          <span>Lx × Ly × h = {g.Lx} × {g.Ly} × {g.h} mm, c = {g.c} mm, bc × hc = {g.bc} × {g.hc} mm, Dp = {g.Dp} mm ({g.pileShape})</span>
          <span>{g.piles.map((q) => `P${q.id}(${q.x}, ${q.y})`).join('  ')}</span>
          <span>NEd = {l.NEd} kN, MEd,x = {l.MEdx} kN·m, MEd,y = {l.MEdy} kN·m</span>
          <span>φ{dt.barDiameter}, {dt.numLayers} layers, {dt.legsPerLayerX} legs X, {dt.legsPerLayerY} legs Y</span>
        </Step>

        <Step title={t('step1')}>
          <span>d = h − c = {g.h} − {g.c} = {fmt(r.d, 1)} mm</span>
          <span>z = 0.85·d = 0.85 × {fmt(r.d, 1)} = {fmt(r.z, 2)} mm</span>
          <span>Σx² = {fmt(sumX2, 0)} mm², Σy² = {fmt(sumY2, 0)} mm²</span>
          {r.piles.map((q) => (
            <span key={q.id}>
              R{q.id} = {l.NEd}/{n} + {l.MEdx}·10³·({q.y})/{fmt(sumY2, 0)} + {l.MEdy}·10³·({q.x})/{fmt(sumX2, 0)} = {fmt(q.R, 2)} kN
              {l.includeSelfWeight && ` ; R${q.id},pile = ${fmt(q.Rtotal, 2)} kN`}
            </span>
          ))}
          {l.includeSelfWeight && <span>W = {fmt(r.selfWeight, 1)} kN. {t('selfWeightNote')}</span>}
        </Step>

        {p && (
          <>
            <Step title={`${t('step2')} (P${p.id})`}>
              <span>x_c = sign({p.x})·{g.bc}/4 = {fmt(p.xc, 1)} mm, y_c = sign({p.y})·{g.hc}/4 = {fmt(p.yc, 1)} mm</span>
              <span>e_x = |{p.x} − {fmt(p.xc, 1)}| = {fmt(p.ex, 1)} mm, e_y = |{p.y} − {fmt(p.yc, 1)}| = {fmt(p.ey, 1)} mm</span>
              <span>a = √(e_x² + e_y²) = {fmt(p.a, 2)} mm {p.a <= 2 * r.d ? `≤ 2d = ${fmt(2 * r.d, 0)} → STM` : `> 2d → ${t('w_FLEXIBLE_CAP')}`}</span>
              <span>L_s = √(a² + z²) = √({fmt(p.a, 2)}² + {fmt(r.z, 2)}²) = {fmt(p.Ls, 2)} mm</span>
              <span>sin θ = z / L_s = {fmt(p.sinTheta, 5)} → θ = {fmt(p.theta, 2)}° {ok(p.theta >= 25)} (≥ 25°)</span>
              <span>F_c = R / sin θ = {fmt(p.R, 2)} / {fmt(p.sinTheta, 5)} = {fmt(p.Fc, 2)} kN</span>
              <span>T_main = R·a/z = {fmt(p.R, 2)} × {fmt(p.a, 2)} / {fmt(r.z, 2)} = {fmt(p.Tmain, 2)} kN</span>
            </Step>

            <Step title={`${t('step3')} (P${p.id})`}>
              <span>ν' = 1 − fck/250 = 1 − {m.fck}/250 = {fmt(r.nu, 3)}</span>
              <span>σRd,max = 0.6·ν'·fcd = 0.6 × {fmt(r.nu, 3)} × {m.fcd} = {fmt(r.sigmaRdMax, 2)} MPa</span>
              <span>A_p = {fmt(r.Ap, 1)} mm², A_strut = A_p·sin θ = {fmt(p.Astrut, 1)} mm²</span>
              <span>σc = F_c·10³ / A_strut = {fmt(p.Fc * 1e3, 0)} / {fmt(p.Astrut, 1)} = {fmt(p.sigma, 2)} MPa {p.sigma <= r.sigmaRdMax ? '≤' : '>'} {fmt(r.sigmaRdMax, 2)} {ok(p.URcrush <= 1)}</span>
            </Step>

            <Step title={`${t('step4')} (P${p.id})`}>
              <span>b_ef = Dp·sin θ = {g.Dp} × {fmt(p.sinTheta, 5)} = {fmt(p.bef, 2)} mm</span>
              <span>H_ef = L_s/2 = {fmt(p.Hef, 2)} mm, b_spread = b_ef + 0.5·H_ef = {fmt(p.bspread, 2)} mm</span>
              {aci ? (
                <span>ACI 318-19 §23.5: T⊥ = 0.25·F_c = {fmt(p.Tperp, 2)} kN</span>
              ) : p.fullDiscontinuity ? (
                <span>b_ef/H_ef = {fmt(p.bef / p.Hef, 4)} &gt; 0.5 → T⊥ = 0.25·(1 − 0.7·b_ef/H_ef)·F_c = {fmt(p.Tperp, 2)} kN</span>
              ) : (
                <span>b_ef/H_ef = {fmt(p.bef / p.Hef, 4)} ≤ 0.5 → T⊥ = 0.25·(b_spread − b_ef)/b_spread·F_c = {fmt(p.Tperp, 2)} kN</span>
              )}
            </Step>

            <Step title={t('step5')}>
              <span>P{p.id}: T_h = T⊥ / sin θ = {fmt(p.Tperp, 2)} / {fmt(p.sinTheta, 5)} = {fmt(p.Th, 2)} kN</span>
              <span>P{p.id}: T_x = T_h·cos α = {fmt(p.Th, 2)} × {fmt(p.cosAlpha, 4)} = {fmt(p.Tx, 2)} kN, T_y = T_h·sin α = {fmt(p.Ty, 2)} kN</span>
              <span>T_design,X = max({fmt(xPos, 2)}, {fmt(xNeg, 2)}) = {fmt(r.TdesignX, 2)} kN</span>
              <span>T_design,Y = max({fmt(yPos, 2)}, {fmt(yNeg, 2)}) = {fmt(r.TdesignY, 2)} kN</span>
              <span>A_s,req,X = {fmt(r.TdesignX, 2)}·10³/{m.fyd} = {fmt(r.AsReqX, 1)} mm², A_s,req,Y = {fmt(r.AsReqY, 1)} mm²</span>
            </Step>
          </>
        )}

        <Step title={t('step6')}>
          <span>z_burst = 0.8·z = {fmt(r.zBurst, 1)} mm, s_v = z_burst/({dt.numLayers} − 1) = {fmt(r.sv, 1)} mm {ok(r.sv >= 100 && r.sv <= 300)} (100–300)</span>
          <span>a_s1 = π·{dt.barDiameter}²/4 = {fmt(r.as1, 2)} mm²</span>
          <span>A_s,prov,X = {dt.numLayers} × {dt.legsPerLayerX} × {fmt(r.as1, 2)} = {fmt(r.AsProvX, 1)} mm² → UR_X = {fmt(r.URX, 3)} {ok(r.URX <= 1)}</span>
          <span>A_s,prov,Y = {dt.numLayers} × {dt.legsPerLayerY} × {fmt(r.as1, 2)} = {fmt(r.AsProvY, 1)} mm² → UR_Y = {fmt(r.URY, 3)} {ok(r.URY <= 1)}</span>
        </Step>

        <section className="mt-5 break-inside-avoid-page">
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr>{['', 'R', 'a', 'θ°', 'Fc', 'σc', 'T⊥', 'Tx', 'Ty'].map((h) => <th key={h} className="border border-line px-1 text-right">{h}</th>)}</tr>
            </thead>
            <tbody>
              {r.piles.map((q) => (
                <tr key={q.id} className="text-right">
                  <td className="border border-line px-1 text-left">P{q.id}</td>
                  {[q.R, q.a, q.theta, q.Fc, q.sigma, q.Tperp, q.Tx, q.Ty].map((v, i) => <td key={i} className="border border-line px-1">{fmt(v, 2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-5 h-[110mm] break-inside-avoid-page">
          <Section2D input={input} result={r} />
        </section>

        {r.warnings.length > 0 && (
          <Step title={t('warnings')}>
            {r.warnings.map((w, i) => <span key={i} className="text-bad">{w.pileId ? `P${w.pileId}: ` : ''}{t(`w_${w.code}` as Key)}</span>)}
          </Step>
        )}
      </article>
    </div>
  );
}
