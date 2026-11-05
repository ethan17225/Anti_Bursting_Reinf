import { describe, expect, it } from 'vitest';
import { calculate, type DesignInput } from './calculationEngine';

const benchmark: DesignInput = {
  material: { standard: 'TCVN_5574_2018', fck: 25, fcd: 14.5, fyk: 400, fyd: 350 },
  geometry: {
    Lx: 2700, Ly: 2700, h: 1500, c: 150, bc: 600, hc: 600, Dp: 600, pileShape: 'CIRCULAR',
    piles: [
      { id: 1, x: -900, y: -900 },
      { id: 2, x: 900, y: -900 },
      { id: 3, x: 900, y: 900 },
      { id: 4, x: -900, y: 900 },
    ],
  },
  load: { NEd: 8000, MEdx: 0, MEdy: 0, includeSelfWeight: false },
  detailing: { barDiameter: 14, numLayers: 4, legsPerLayerX: 4, legsPerLayerY: 4 },
};

const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(0.01);

describe('benchmark: 4-pile cap (spec section 6)', () => {
  const r = calculate(benchmark);
  const p = r.piles[2];

  it('matches every expected value within 1%', () => {
    for (const pile of r.piles) near(pile.R, 2000);
    near(r.z, 1147.5);
    near(Math.abs(p.xc), 150);
    near(Math.abs(p.yc), 150);
    near(p.ex, 750);
    near(p.ey, 750);
    near(p.a, 1060.66);
    near(p.Ls, 1562.61);
    near(p.sinTheta, 0.73435);
    near(p.theta, 47.25);
    near(p.Fc, 2723.5);
    near(r.nu, 0.9);
    near(r.sigmaRdMax, 7.83);
    near(r.Ap, 282743.3);
    near(p.Astrut, 207632.6);
    near(p.sigma, 13.12);
    near(p.bef, 440.61);
    near(p.Hef, 781.31);
    expect(p.fullDiscontinuity).toBe(true);
    near(p.Tperp, 412.11);
    near(p.Th, 561.19);
    near(p.Tx, 396.82);
    near(p.Ty, 396.82);
    near(r.TdesignX, 793.64);
    near(r.TdesignY, 793.64);
    near(r.AsReqX, 2267.5);
    near(r.as1, 153.94);
    near(r.AsProvX, 2463.0);
    near(r.URX, 0.921);
    near(r.URY, 0.921);
  });

  it('flags crushing and the sv range, not burst failure', () => {
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('CRUSHING_FAILURE');
    expect(codes).toContain('SV_RANGE');
    expect(codes).not.toContain('BURST_X_FAIL');
    expect(codes).not.toContain('THETA_LOW');
  });

  it('survives a 2-pile cap on the X axis with moments', () => {
    const two = calculate({
      ...benchmark,
      geometry: { ...benchmark.geometry, piles: [{ id: 1, x: -900, y: 0 }, { id: 2, x: 900, y: 0 }] },
      load: { NEd: 4000, MEdx: 300, MEdy: 500, includeSelfWeight: true },
    });
    for (const pile of two.piles) expect(Number.isFinite(pile.R)).toBe(true);
    expect(two.TdesignY).toBe(0);
    expect(two.piles[1].R).toBeGreaterThan(two.piles[0].R);
  });
});
