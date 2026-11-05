import { describe, expect, it } from 'vitest';
import { calculate } from './calculationEngine';
import { DEFAULT_VN_COST_RATES, LIMITS, clearances, costOf, heightSweep, optimize } from './costOptimizer';
import { VN_HIGHRISE_PRESETS } from './presets';

const rates = DEFAULT_VN_COST_RATES;

describe('cost model', () => {
  it('prices the concrete, formwork and excavation of VN_PRESET_01 by hand', () => {
    const input = VN_HIGHRISE_PRESETS[0].input;
    const c = costOf(input, calculate(input), rates);
    expect(c.concreteVolumeM3).toBeCloseTo(14.4, 6); // 3.0 × 3.0 × 1.6
    expect(c.concrete).toBeCloseTo(14.4 * 1580000, 0);
    expect(c.formworkExcavation).toBeCloseTo(2 * 6 * 1.6 * 280000 + 1.25 * 14.4 * 320000, 0);
    // 4 layers × (4 + 4) legs × (2850 + 320) mm of φ16
    expect(c.burstingSteelMassKg).toBeCloseTo(4 * 8 * 3.17 * Math.PI * 64e-6 * 7850, 3);
  });
});

describe('optimizer on every VN preset', () => {
  for (const p of VN_HIGHRISE_PRESETS) {
    it(`${p.id}: feasible candidates meet every constraint`, () => {
      const t0 = performance.now();
      const candidates = optimize(p.input, rates);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(200);
      for (const c of candidates.filter((x) => x.feasible)) {
        const r = calculate(c.input);
        const cl = clearances(c.input.geometry, c.input.detailing, r.sv);
        expect(c.metrics.minThetaDeg).toBeGreaterThanOrEqual(LIMITS.thetaMin);
        expect(c.metrics.maxCrushingUR).toBeLessThanOrEqual(LIMITS.urMax);
        expect(Math.max(r.URX, r.URY)).toBeLessThanOrEqual(LIMITS.urMax);
        expect(r.sv).toBeGreaterThanOrEqual(LIMITS.svMin);
        expect(r.sv).toBeLessThanOrEqual(LIMITS.svMax);
        expect(Math.min(cl.x, cl.y)).toBeGreaterThanOrEqual(LIMITS.clearMin);
        if (c.input.geometry.h >= 2000) expect(c.input.detailing.barDiameter).toBeGreaterThanOrEqual(14);
      }
      const [rebar, upgrade, global] = candidates;
      expect(rebar.input.geometry.h).toBe(p.input.geometry.h);
      expect(rebar.input.material.fcd).toBe(p.input.material.fcd);
      expect(upgrade.input.geometry.h).toBe(p.input.geometry.h);
      // VN_PRESET_05 only stops crushing near h = 5300 at B50, where 10 layers cannot keep s_v <= 280 mm.
      expect(global.feasible).toBe(p.id !== 'VN_PRESET_05');
      for (const c of [rebar, upgrade].filter((x) => x.feasible)) {
        expect(global.metrics.totalCostVND).toBeLessThanOrEqual(c.metrics.totalCostVND + 1);
      }
    });
  }

  it('sweeps cost against h from h-400 to h+600', () => {
    const pts = heightSweep(VN_HIGHRISE_PRESETS[0].input, rates);
    expect(pts[0].h).toBe(1200);
    expect(pts.at(-1)!.h).toBe(2200);
    expect(pts.length).toBe(11);
  });
});
