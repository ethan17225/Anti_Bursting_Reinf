import type { DesignInput, GeometryInput } from './calculationEngine';

export const CONCRETE_GRADES = [
  { id: 'B25', fck: 25, fcd: 14.5 },
  { id: 'B30', fck: 30, fcd: 17 },
  { id: 'B35', fck: 35, fcd: 19.5 },
  { id: 'B40', fck: 40, fcd: 22 },
] as const;

export const STEEL_GRADES = [
  { id: 'CB300-V', fyk: 300, fyd: 260 },
  { id: 'CB400-V', fyk: 400, fyd: 350 },
  { id: 'CB500-V', fyk: 500, fyd: 435 },
] as const;

export const BAR_DIAMETERS = [10, 12, 14, 16, 18, 20, 22];
export const LEG_COUNTS = [2, 4, 6, 8];

export type LayoutId = 'P2' | 'P3' | 'P4' | 'P6';
export const LAYOUTS: LayoutId[] = ['P2', 'P3', 'P4', 'P6'];

const EDGE = 150; // mm from pile face to cap edge

/** Pile coordinates at 3*Dp spacing, centred on the column, plus the cap size that encloses them. */
export function layoutGeometry(id: LayoutId, Dp: number): Pick<GeometryInput, 'piles' | 'Lx' | 'Ly'> {
  const s = 3 * Dp;
  const raw = ({
    P2: [[-s / 2, 0], [s / 2, 0]],
    P3: [[-s / 2, -s / (2 * Math.sqrt(3))], [s / 2, -s / (2 * Math.sqrt(3))], [0, s / Math.sqrt(3)]],
    P4: [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]],
    P6: [[-s, -s / 2], [0, -s / 2], [s, -s / 2], [-s, s / 2], [0, s / 2], [s, s / 2]],
  } as Record<LayoutId, Array<[number, number]>>)[id];
  const piles = raw.map(([x, y], i) => ({ id: i + 1, x: Math.round(x), y: Math.round(y) }));
  const span = (k: 'x' | 'y') => Math.max(...piles.map((p) => p[k])) - Math.min(...piles.map((p) => p[k]));
  return { piles, Lx: span('x') + Dp + 2 * EDGE, Ly: span('y') + Dp + 2 * EDGE };
}

export const DEFAULT_INPUT: DesignInput = {
  material: { standard: 'TCVN_5574_2018', fck: 25, fcd: 14.5, fyk: 400, fyd: 350 },
  geometry: { h: 1500, c: 150, bc: 600, hc: 600, Dp: 600, pileShape: 'CIRCULAR', ...layoutGeometry('P4', 600) },
  load: { NEd: 8000, MEdx: 0, MEdy: 0, includeSelfWeight: false },
  detailing: { barDiameter: 14, numLayers: 4, legsPerLayerX: 4, legsPerLayerY: 4 },
};
