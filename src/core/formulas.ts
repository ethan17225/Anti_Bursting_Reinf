import { C_SIDE, clearances } from './costOptimizer';
import type { DesignInput, DesignResult, PileResult } from './calculationEngine';
import { fmt } from './format';
import type { Key } from '../i18n';

export type FormulaId =
  | 'd' | 'z' | 'R' | 'a' | 'theta' | 'Fc' | 'Tperp' | 'Tx' | 'Ty'
  | 'TdesignX' | 'TdesignY' | 'crush' | 'burstX' | 'burstY' | 'clear';

export interface Explanation {
  title: Key;
  symbol: string;
  pile?: string;
  lines: string[];
  /** The value the screen shows, taken from the calculation result. */
  value: string;
  foot?: Key;
}

const n = (v: number, digits = 1) => fmt(v, digits);

function pileOf(r: DesignResult, id?: number | null): PileResult {
  return r.piles.find((p) => p.id === id) ?? r.piles.find((p) => p.active) ?? r.piles[0];
}

function sides(r: DesignResult, coord: 'x' | 'y', force: 'Tx' | 'Ty') {
  let pos = 0;
  let neg = 0;
  for (const p of r.piles) {
    if (p[coord] >= 0) pos += p[force];
    else neg += p[force];
  }
  return { pos, neg };
}

const noStrut = (p: PileResult, title: Key, symbol: string): Explanation => ({
  title, symbol, pile: `P${p.id}`, lines: ['R ≤ 0'], value: '0',
});

/** Formula and substituted numbers for one result. Every result number comes from `calculate`. */
export function explain(id: FormulaId, input: DesignInput, r: DesignResult, pileId?: number | null): Explanation {
  const { material: m, geometry: g, load, detailing: d } = input;
  const p = pileOf(r, pileId);
  const pile = `P${p.id}`;

  if (id === 'd') return { title: 'f_d', symbol: 'd', lines: [`d = h − c = ${g.h} − ${g.c}`], value: `${n(r.d, 0)} mm` };
  if (id === 'z') return { title: 'f_z', symbol: 'z', lines: [`z = 0.85·d = 0.85 × ${n(r.d, 1)}`], value: `${n(r.z)} mm` };

  if (id === 'R') {
    const piles = g.piles;
    const sumX2 = piles.reduce((s, q) => s + q.x * q.x, 0);
    const sumY2 = piles.reduce((s, q) => s + q.y * q.y, 0);
    const termY = sumY2 > 0 ? (load.MEdx * 1e3 * p.y) / sumY2 : 0;
    const termX = sumX2 > 0 ? (load.MEdy * 1e3 * p.x) / sumX2 : 0;
    const lines = [
      'R = N/n + MEd,x·10³·y / Σy² + MEd,y·10³·x / Σx²',
      `= ${load.NEd}/${piles.length} + ${n(termY)} + ${n(termX)}`,
      `Σx² = ${n(sumX2, 0)} mm², Σy² = ${n(sumY2, 0)} mm²`,
    ];
    if (load.includeSelfWeight) lines.push(`W = 25·Lx·Ly·h·10⁻⁹ = ${n(r.selfWeight)} kN`);
    return { title: 'f_R', symbol: 'R', pile, lines, value: `${n(p.R)} kN`, foot: load.includeSelfWeight ? 'f_selfWeight' : undefined };
  }

  if (id === 'a') {
    return {
      title: 'f_a', symbol: 'a', pile, value: `${n(p.a, 0)} mm`,
      lines: [
        `x_c = sign(x)·b_c/4 = sign(${p.x})·${g.bc}/4 = ${n(p.xc)} mm`,
        `y_c = sign(y)·h_c/4 = sign(${p.y})·${g.hc}/4 = ${n(p.yc)} mm`,
        `e_x = |x − x_c| = |${p.x} − ${n(p.xc)}| = ${n(p.ex)} mm`,
        `e_y = |y − y_c| = |${p.y} − ${n(p.yc)}| = ${n(p.ey)} mm`,
        'a = √(e_x² + e_y²)',
        `a ${p.a <= 2 * r.d ? '≤' : '>'} 2d = ${n(2 * r.d, 0)} mm`,
      ],
    };
  }

  if (id === 'theta') {
    return {
      title: 'f_theta', symbol: 'θ', pile, value: `${n(p.theta, 2)}°`,
      lines: [
        `L_s = √(a² + z²) = √(${n(p.a)}² + ${n(r.z)}²) = ${n(p.Ls)} mm`,
        `sinθ = z / L_s = ${n(r.z)} / ${n(p.Ls)} = ${n(p.sinTheta, 5)}`,
        'θ = arcsin(sinθ)',
        'θ ≥ 25°',
      ],
    };
  }

  if (!p.active && (id === 'Fc' || id === 'Tperp' || id === 'Tx' || id === 'Ty' || id === 'crush')) return noStrut(p, 'f_Fc', 'F_c');

  if (id === 'Fc') {
    return {
      title: 'f_Fc', symbol: 'F_c', pile, value: `${n(p.Fc)} kN`,
      lines: [`F_c = R / sinθ = ${n(p.R)} / ${n(p.sinTheta, 5)}`],
    };
  }

  if (id === 'Tperp') {
    const lines = [`F_c = ${n(p.Fc)} kN`];
    if (m.standard === 'ACI_318_19') lines.push(`ACI 318-19 §23.5: T⊥ = 0.25·F_c = 0.25 × ${n(p.Fc)}`);
    else {
      lines.push(
        `b_ef = D_p·sinθ = ${g.Dp} × ${n(p.sinTheta, 5)} = ${n(p.bef)} mm`,
        `H_ef = L_s/2 = ${n(p.Hef)} mm, b_spread = b_ef + 0.5·H_ef = ${n(p.bspread)} mm`,
        `b_ef/H_ef = ${p.Hef > 0 ? n(p.bef / p.Hef, 3) : '–'} ${p.fullDiscontinuity ? '>' : '≤'} 0.5`,
      );
      lines.push(p.fullDiscontinuity
        ? `T⊥ = 0.25·(1 − 0.7·b_ef/H_ef)·F_c`
        : `T⊥ = 0.25·(b_spread − b_ef)/b_spread·F_c`);
    }
    return { title: 'f_Tperp', symbol: 'T⊥', pile, lines, value: `${n(p.Tperp)} kN` };
  }

  if (id === 'Tx' || id === 'Ty') {
    const y = id === 'Ty';
    return {
      title: y ? 'f_Ty' : 'f_Tx', symbol: y ? 'T_y' : 'T_x', pile,
      value: `${n(y ? p.Ty : p.Tx)} kN`,
      lines: [
        `T_h = T⊥ / sinθ = ${n(p.Tperp)} / ${n(p.sinTheta, 5)} = ${n(p.Th)} kN`,
        y
          ? `sinα = e_y/a = ${n(p.ey)} / ${n(p.a)} = ${n(p.sinAlpha, 4)}, T_y = T_h·sinα`
          : `cosα = e_x/a = ${n(p.ex)} / ${n(p.a)} = ${n(p.cosAlpha, 4)}, T_x = T_h·cosα`,
      ],
    };
  }

  if (id === 'TdesignX' || id === 'TdesignY') {
    const y = id === 'TdesignY';
    const s = sides(r, y ? 'y' : 'x', y ? 'Ty' : 'Tx');
    const design = y ? r.TdesignY : r.TdesignX;
    return {
      title: y ? 'f_TY' : 'f_TX', symbol: y ? 'T_design,Y' : 'T_design,X',
      value: `${n(design)} kN`,
      lines: [
        `Σ ${y ? 'T_y' : 'T_x'} (${y ? 'y' : 'x'} ≥ 0) = ${n(s.pos)} kN`,
        `Σ ${y ? 'T_y' : 'T_x'} (${y ? 'y' : 'x'} < 0) = ${n(s.neg)} kN`,
        `T_design = max(${n(s.pos)}, ${n(s.neg)})`,
      ],
    };
  }

  if (id === 'crush') {
    const shape = g.pileShape === 'CIRCULAR' ? `π·${g.Dp}²/4` : `${g.Dp}²`;
    return {
      title: 'f_crush', symbol: 'UR', pile, value: `${n(p.URcrush, 2)}`,
      foot: m.standard === 'ACI_318_19' ? 'f_aciCrush' : undefined,
      lines: [
        `ν' = 1 − fck/250 = 1 − ${m.fck}/250 = ${n(r.nu, 3)}`,
        `σRd,max = 0.6·ν'·fcd = 0.6 × ${n(r.nu, 3)} × ${m.fcd} = ${n(r.sigmaRdMax, 2)} MPa`,
        `A_p = ${shape} = ${n(r.Ap, 0)} mm²`,
        `A_strut = A_p·sinθ = ${n(r.Ap, 0)} × ${n(p.sinTheta, 5)} = ${n(p.Astrut, 1)} mm²`,
        `σc = F_c·10³ / A_strut = ${n(p.Fc * 1e3, 0)} / ${n(p.Astrut, 1)} = ${n(p.sigma, 2)} MPa`,
        'UR = σc / σRd,max ≤ 1',
      ],
    };
  }

  if (id === 'burstX' || id === 'burstY') {
    const y = id === 'burstY';
    const design = y ? r.TdesignY : r.TdesignX;
    const req = y ? r.AsReqY : r.AsReqX;
    const prov = y ? r.AsProvY : r.AsProvX;
    const ur = y ? r.URY : r.URX;
    const legs = y ? d.legsPerLayerY : d.legsPerLayerX;
    const s = sides(r, y ? 'y' : 'x', y ? 'Ty' : 'Tx');
    return {
      title: y ? 'f_burstY' : 'f_burstX', symbol: y ? 'UR_Y' : 'UR_X', value: n(ur, 3),
      lines: [
        `Σ (${y ? 'y' : 'x'} ≥ 0) = ${n(s.pos)} kN, Σ (${y ? 'y' : 'x'} < 0) = ${n(s.neg)} kN`,
        `T_design = max = ${n(design)} kN`,
        `A_s,req = T_design·10³ / fyd = ${n(design)}·10³ / ${m.fyd} = ${n(req, 1)} mm²`,
        `a_s1 = π·φ²/4 = π·${d.barDiameter}²/4 = ${n(r.as1, 2)} mm²`,
        `A_s,prov = ${d.numLayers} × ${legs} × ${n(r.as1, 2)} = ${n(prov, 1)} mm²`,
        'UR = A_s,req / A_s,prov ≤ 1',
      ],
    };
  }

  const cl = clearances(g, d, r.sv);
  const layers = Math.max(d.numLayers - 1, 1);
  return {
    title: 'f_clear', symbol: 's_clear', value: `v ${n(cl.vertical, 0)} mm · h ${n(Math.min(cl.x, cl.y), 0)} mm`,
    lines: [
      `z_burst = 0.8·z = 0.8 × ${n(r.z)} = ${n(r.zBurst)} mm`,
      `s_v = z_burst / (${d.numLayers} − 1) = ${n(r.zBurst)} / ${layers} = ${n(r.sv)} mm`,
      `s_clear,v = s_v − φ = ${n(r.sv, 0)} − ${d.barDiameter} = ${n(cl.vertical, 0)} mm`,
      `s_clear,X = (L_y − 2·${C_SIDE}) / (n_x − 1) − φ = ${n(cl.x, 0)} mm`,
      `s_clear,Y = (L_x − 2·${C_SIDE}) / (n_y − 1) − φ = ${n(cl.y, 0)} mm`,
      's_clear,h = min(s_clear,X, s_clear,Y)',
    ],
  };
}
