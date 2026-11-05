import { calculate, type DesignInput, type DesignResult, type DetailingInput, type GeometryInput } from './calculationEngine';
import { BAR_DIAMETERS, CONCRETE_GRADES, LEG_COUNTS, gradeOf, type GradeId } from './presets';

export interface CostUnitRates {
  concretePricePerM3: Record<string, number>;
  rebarPricePerKg: number;
  formworkPricePerM2: number;
  excavationPricePerM3: number;
}

export const DEFAULT_VN_COST_RATES: CostUnitRates = {
  concretePricePerM3: { B25: 1450000, B30: 1580000, B35: 1720000, B40: 1890000, B45: 2100000, B50: 2350000 },
  rebarPricePerKg: 22500,
  formworkPricePerM2: 280000,
  excavationPricePerM3: 320000,
};

export type StrategyType = 'REBAR_ONLY' | 'UPGRADE_CONCRETE_KEEP_H' | 'GLOBAL_MIN_COST';
export type InfeasibleReason = 'STRUT_FAILS' | 'NO_REBAR' | 'NO_GRADE' | 'NO_DESIGN';

export interface OptimizationCandidate {
  strategyType: StrategyType;
  feasible: boolean;
  infeasibleReason?: InfeasibleReason;
  input: DesignInput;
  proposedChanges: {
    h: number;
    concreteGrade: string;
    fck: number;
    fcd: number;
    barDiameter: number;
    numLayers: number;
    legsPerLayerX: number;
    legsPerLayerY: number;
  };
  metrics: {
    minThetaDeg: number;
    maxCrushingUR: number;
    maxBurstingUR: number;
    verticalSpacingSv: number;
    burstingSteelMassKg: number;
    mainSteelMassKg: number;
    concreteVolumeM3: number;
    totalCostVND: number;
    costDeltaVND: number;
    costDeltaPercent: number;
  };
}

const STEEL_DENSITY = 7850; // kg/m3
const C_SIDE = 75; // mm
export const LIMITS = { thetaMin: 26.5, urMax: 0.98, svMin: 110, svMax: 280, clearMin: 100 };
const PRICE_GRADES: GradeId[] = ['B30', 'B35', 'B40', 'B45'];
export const H_SEARCH_UP = 2000; // mm above the current depth the global search may go

/** Clear gaps between bars (mm): vertical between layers, horizontal between X legs and between Y legs. */
export function clearances(g: Pick<GeometryInput, 'Lx' | 'Ly'>, d: DetailingInput, sv: number) {
  return {
    vertical: sv - d.barDiameter,
    x: (g.Ly - 2 * C_SIDE) / Math.max(d.legsPerLayerX - 1, 1) - d.barDiameter,
    y: (g.Lx - 2 * C_SIDE) / Math.max(d.legsPerLayerY - 1, 1) - d.barDiameter,
  };
}

const burstMass = (g: GeometryInput, d: DetailingInput) => {
  const lx = g.Lx - 2 * C_SIDE + 20 * d.barDiameter;
  const ly = g.Ly - 2 * C_SIDE + 20 * d.barDiameter;
  const length = d.numLayers * (d.legsPerLayerX * lx + d.legsPerLayerY * ly) * 1e-3;
  return length * ((Math.PI * d.barDiameter ** 2) / 4) * 1e-6 * STEEL_DENSITY;
};

export interface CostBreakdown {
  concreteVolumeM3: number;
  concrete: number;
  burstingSteelMassKg: number;
  mainSteelMassKg: number;
  steel: number;
  formworkExcavation: number;
  total: number;
}

export function costOf(input: DesignInput, r: DesignResult, rates: CostUnitRates): CostBreakdown {
  const { geometry: g, material: m, detailing: d } = input;
  const V = (g.Lx * g.Ly * g.h) / 1e9;
  const concrete = V * (rates.concretePricePerM3[gradeOf(m.fcd).id] ?? 0);

  const side = (coord: 'x' | 'y', ecc: 'ex' | 'ey') => {
    let pos = 0;
    let neg = 0;
    for (const p of r.piles) {
      if (!p.active) continue;
      const t = (p.R * p[ecc]) / r.z;
      if (p[coord] >= 0) pos += t;
      else neg += t;
    }
    return Math.max(pos, neg);
  };
  const AsMainX = Math.max((side('x', 'ex') * 1e3) / m.fyd, 0.0015 * g.Ly * r.d);
  const AsMainY = Math.max((side('y', 'ey') * 1e3) / m.fyd, 0.0015 * g.Lx * r.d);
  const mainSteelMassKg = 1.18 * (AsMainX * g.Lx + AsMainY * g.Ly) * 1e-9 * STEEL_DENSITY;
  const burstingSteelMassKg = burstMass(g, d);
  const steel = (burstingSteelMassKg + mainSteelMassKg) * rates.rebarPricePerKg;

  const formwork = ((2 * (g.Lx + g.Ly) * g.h) / 1e6) * rates.formworkPricePerM2;
  const excavation = 1.25 * V * rates.excavationPricePerM3;
  const formworkExcavation = formwork + excavation;
  return { concreteVolumeM3: V, concrete, burstingSteelMassKg, mainSteelMassKg, steel, formworkExcavation, total: concrete + steel + formworkExcavation };
}

function strutState(r: DesignResult) {
  const active = r.piles.filter((p) => p.active);
  const minTheta = active.length ? Math.min(...active.map((p) => p.theta)) : 90;
  const maxCrush = active.length ? Math.max(...active.map((p) => p.URcrush)) : 0;
  return { minTheta, maxCrush, ok: active.length > 0 && minTheta >= LIMITS.thetaMin && maxCrush <= LIMITS.urMax };
}

/** Lightest anti-bursting cage meeting every detailing constraint, for a fixed cap and concrete. */
export function bestRebar(input: DesignInput, r: DesignResult): DetailingInput | null {
  const g = input.geometry;
  let best: DetailingInput | null = null;
  let bestMass = Infinity;
  for (const barDiameter of BAR_DIAMETERS) {
    if (g.h >= 2000 && barDiameter < 14) continue;
    const as1 = (Math.PI * barDiameter ** 2) / 4;
    for (let numLayers = 2; numLayers <= 10; numLayers++) {
      const sv = r.zBurst / (numLayers - 1);
      if (sv < LIMITS.svMin || sv > LIMITS.svMax) continue;
      for (const legsPerLayerX of LEG_COUNTS) {
        if (r.AsReqX / (numLayers * legsPerLayerX * as1) > LIMITS.urMax) continue;
        for (const legsPerLayerY of LEG_COUNTS) {
          if (r.AsReqY / (numLayers * legsPerLayerY * as1) > LIMITS.urMax) continue;
          const d = { barDiameter, numLayers, legsPerLayerX, legsPerLayerY };
          const cl = clearances(g, d, sv);
          if (cl.x < LIMITS.clearMin || cl.y < LIMITS.clearMin) continue;
          const mass = burstMass(g, d);
          if (mass < bestMass) {
            bestMass = mass;
            best = d;
          }
        }
      }
    }
  }
  return best;
}

const withChanges = (input: DesignInput, h: number, grade: (typeof CONCRETE_GRADES)[number]): DesignInput => ({
  ...input,
  geometry: { ...input.geometry, h },
  material: { ...input.material, fck: grade.fck, fcd: grade.fcd },
});

/** Best feasible design for one (h, grade): its input, result and cost, or why it fails. */
function solve(input: DesignInput, rates: CostUnitRates): { input: DesignInput; cost: number } | InfeasibleReason {
  const r = calculate(input);
  if (!strutState(r).ok) return 'STRUT_FAILS';
  const detailing = bestRebar(input, r);
  if (!detailing) return 'NO_REBAR';
  const fixed = { ...input, detailing };
  return { input: fixed, cost: costOf(fixed, calculate(fixed), rates).total };
}

function candidate(strategyType: StrategyType, base: DesignInput, baseCost: number, rates: CostUnitRates,
  found: DesignInput | null, reason?: InfeasibleReason): OptimizationCandidate {
  const input = found ?? base;
  const r = calculate(input);
  const s = strutState(r);
  const c = costOf(input, r, rates);
  const grade = gradeOf(input.material.fcd);
  return {
    strategyType,
    feasible: !!found,
    infeasibleReason: found ? undefined : reason,
    input,
    proposedChanges: {
      h: input.geometry.h, concreteGrade: grade.id, fck: input.material.fck, fcd: input.material.fcd,
      ...input.detailing,
    },
    metrics: {
      minThetaDeg: s.minTheta,
      maxCrushingUR: s.maxCrush,
      maxBurstingUR: Math.max(r.URX, r.URY),
      verticalSpacingSv: r.sv,
      burstingSteelMassKg: c.burstingSteelMassKg,
      mainSteelMassKg: c.mainSteelMassKg,
      concreteVolumeM3: c.concreteVolumeM3,
      totalCostVND: c.total,
      costDeltaVND: c.total - baseCost,
      costDeltaPercent: baseCost > 0 ? ((c.total - baseCost) / baseCost) * 100 : 0,
    },
  };
}

function pickCheapest(options: DesignInput[], rates: CostUnitRates) {
  let best: { input: DesignInput; cost: number } | null = null;
  let reason: InfeasibleReason = 'NO_DESIGN';
  for (const o of options) {
    const s = solve(o, rates);
    if (typeof s === 'string') reason = s;
    else if (!best || s.cost < best.cost) best = s;
  }
  return { best, reason };
}

export function optimize(input: DesignInput, rates: CostUnitRates): OptimizationCandidate[] {
  const baseCost = costOf(input, calculate(input), rates).total;
  const current = gradeOf(input.material.fcd);
  const h0 = input.geometry.h;

  const rebarOnly = solve(input, rates);

  const upgrades = CONCRETE_GRADES.filter((g) => g.fcd >= current.fcd).map((g) => withChanges(input, h0, g));
  const upgrade = pickCheapest(upgrades, rates);

  const heights: number[] = [];
  for (let h = Math.max(h0 - 800, input.geometry.c + 600); h <= h0 + H_SEARCH_UP; h += 100) heights.push(h);
  const globals = heights.flatMap((h) =>
    CONCRETE_GRADES.filter((g) => PRICE_GRADES.includes(g.id)).map((g) => withChanges(input, h, g)));
  const global = pickCheapest(globals, rates);

  return [
    candidate('REBAR_ONLY', input, baseCost, rates, typeof rebarOnly === 'string' ? null : rebarOnly.input, typeof rebarOnly === 'string' ? rebarOnly : undefined),
    candidate('UPGRADE_CONCRETE_KEEP_H', input, baseCost, rates, upgrade.best?.input ?? null, upgrade.best ? undefined : upgrade.reason === 'STRUT_FAILS' ? 'NO_GRADE' : upgrade.reason),
    candidate('GLOBAL_MIN_COST', input, baseCost, rates, global.best?.input ?? null, global.best ? undefined : 'NO_DESIGN'),
  ];
}

export interface SweepPoint {
  h: number;
  concreteFormExc: number;
  steel: number;
  total: number;
  crushing: boolean;
  feasible: boolean;
}

/** Cost against cap depth at the current grade, each depth with its own lightest valid cage. */
export function heightSweep(input: DesignInput, rates: CostUnitRates): SweepPoint[] {
  const points: SweepPoint[] = [];
  const h0 = input.geometry.h;
  for (let h = h0 - 400; h <= h0 + 600; h += 100) {
    if (h < input.geometry.c + 300) continue;
    const at = { ...input, geometry: { ...input.geometry, h } };
    const r = calculate(at);
    const s = strutState(r);
    const detailing = bestRebar(at, r);
    const design = detailing ? { ...at, detailing } : at;
    const c = costOf(design, calculate(design), rates);
    points.push({ h, concreteFormExc: c.concrete + c.formworkExcavation, steel: c.steel, total: c.total, crushing: s.maxCrush > 1, feasible: s.ok && !!detailing });
  }
  return points;
}
