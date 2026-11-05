export interface MaterialInput {
  standard: 'EC2' | 'TCVN_5574_2018' | 'ACI_318_19';
  fck: number;
  fcd: number;
  fyk: number;
  fyd: number;
}

export interface GeometryInput {
  Lx: number;
  Ly: number;
  h: number;
  c: number;
  bc: number;
  hc: number;
  Dp: number;
  pileShape: 'CIRCULAR' | 'SQUARE';
  piles: Array<{ id: number; x: number; y: number }>;
}

export interface LoadInput {
  NEd: number;
  MEdx: number;
  MEdy: number;
  includeSelfWeight: boolean;
}

export interface DetailingInput {
  barDiameter: number;
  numLayers: number;
  legsPerLayerX: number;
  legsPerLayerY: number;
}

export interface Viewer3DConfig {
  showConcreteShell: boolean;
  showStrutAndTie: boolean;
  showBottleBulge: boolean;
  showBurstingArrows: boolean;
  showRebarCage: boolean;
  showLabels: boolean;
  cameraMode: 'PERSPECTIVE' | 'ORTHO_TOP' | 'ORTHO_FRONT' | 'ORTHO_SIDE';
  selectedPileId: number | null;
}

export interface DesignInput {
  material: MaterialInput;
  geometry: GeometryInput;
  load: LoadInput;
  detailing: DetailingInput;
}

export type WarningCode =
  | 'TENSION_PILE'
  | 'FLEXIBLE_CAP'
  | 'THETA_LOW'
  | 'CRUSHING_FAILURE'
  | 'SV_RANGE'
  | 'BURST_X_FAIL'
  | 'BURST_Y_FAIL';

export interface Warning {
  code: WarningCode;
  pileId?: number;
}

export interface PileResult {
  id: number;
  x: number;
  y: number;
  R: number;
  Rtotal: number;
  active: boolean;
  xc: number;
  yc: number;
  ex: number;
  ey: number;
  a: number;
  Ls: number;
  sinTheta: number;
  theta: number;
  cosAlpha: number;
  sinAlpha: number;
  Fc: number;
  Tmain: number;
  Astrut: number;
  sigma: number;
  URcrush: number;
  bef: number;
  Hef: number;
  bspread: number;
  fullDiscontinuity: boolean;
  Tperp: number;
  Th: number;
  Tx: number;
  Ty: number;
}

export interface DesignResult {
  d: number;
  z: number;
  selfWeight: number;
  nu: number;
  sigmaRdMax: number;
  Ap: number;
  piles: PileResult[];
  TdesignX: number;
  TdesignY: number;
  AsReqX: number;
  AsReqY: number;
  as1: number;
  AsProvX: number;
  AsProvY: number;
  URX: number;
  URY: number;
  zBurst: number;
  sv: number;
  zBottomLayer: number;
  warnings: Warning[];
}

export const CONCRETE_UNIT_WEIGHT = 25; // kN/m3

const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function calculate({ material, geometry, load, detailing }: DesignInput): DesignResult {
  const { Lx, Ly, h, c, bc, hc, Dp, pileShape, piles } = geometry;
  const warnings: Warning[] = [];
  const n = piles.length;

  // Step 1
  const d = h - c;
  const z = 0.85 * d;
  const sumX2 = piles.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = piles.reduce((s, p) => s + p.y * p.y, 0);
  const selfWeight = CONCRETE_UNIT_WEIGHT * Lx * Ly * h * 1e-9;

  // Step 3 constants
  const nu = 1 - material.fck / 250;
  const sigmaRdMax = 0.6 * nu * material.fcd;
  const Ap = pileShape === 'CIRCULAR' ? (Math.PI * Dp * Dp) / 4 : Dp * Dp;

  const results: PileResult[] = piles.map((p) => {
    const R =
      load.NEd / n +
      (sumY2 > 0 ? (load.MEdx * 1e3 * p.y) / sumY2 : 0) +
      (sumX2 > 0 ? (load.MEdy * 1e3 * p.x) / sumX2 : 0);
    const Rtotal = R + (load.includeSelfWeight ? selfWeight / n : 0);
    const active = R > 0;
    if (!active) warnings.push({ code: 'TENSION_PILE', pileId: p.id });

    // Step 2
    const xc = (sign(p.x) * bc) / 4;
    const yc = (sign(p.y) * hc) / 4;
    const ex = Math.abs(p.x - xc);
    const ey = Math.abs(p.y - yc);
    const a = Math.hypot(ex, ey);
    const Ls = Math.hypot(a, z);
    const sinTheta = z / Ls;
    const theta = (Math.asin(sinTheta) * 180) / Math.PI;
    const cosAlpha = a > 0 ? ex / a : 0;
    const sinAlpha = a > 0 ? ey / a : 0;

    const base = { id: p.id, x: p.x, y: p.y, R, Rtotal, active, xc, yc, ex, ey, a, Ls, sinTheta, theta, cosAlpha, sinAlpha };
    const bef = Dp * sinTheta;
    const Hef = Ls / 2;
    const bspread = bef + 0.5 * Hef;
    const fullDiscontinuity = bef > Hef / 2;
    const Astrut = Ap * sinTheta;

    if (!active) {
      return { ...base, Fc: 0, Tmain: 0, Astrut, sigma: 0, URcrush: 0, bef, Hef, bspread, fullDiscontinuity, Tperp: 0, Th: 0, Tx: 0, Ty: 0 };
    }

    if (a > 2 * d) warnings.push({ code: 'FLEXIBLE_CAP', pileId: p.id });
    if (theta < 25) warnings.push({ code: 'THETA_LOW', pileId: p.id });

    const Fc = R / sinTheta;
    const Tmain = (R * a) / z;

    // Step 3
    const sigma = (Fc * 1e3) / Astrut;
    const URcrush = sigma / sigmaRdMax;
    if (URcrush > 1) warnings.push({ code: 'CRUSHING_FAILURE', pileId: p.id });

    // Step 4
    const Tperp =
      material.standard === 'ACI_318_19'
        ? 0.25 * Fc
        : fullDiscontinuity
          ? 0.25 * (1 - (0.7 * bef) / Hef) * Fc
          : 0.25 * ((bspread - bef) / bspread) * Fc;

    // Step 5
    const Th = Tperp / sinTheta;
    return { ...base, Fc, Tmain, Astrut, sigma, URcrush, bef, Hef, bspread, fullDiscontinuity, Tperp, Th, Tx: Th * cosAlpha, Ty: Th * sinAlpha };
  });

  const sideMax = (pick: (p: PileResult) => [number, number]) => {
    let pos = 0;
    let neg = 0;
    for (const p of results) {
      const [coord, t] = pick(p);
      if (coord >= 0) pos += t;
      else neg += t;
    }
    return Math.max(pos, neg);
  };
  const TdesignX = sideMax((p) => [p.x, p.Tx]);
  const TdesignY = sideMax((p) => [p.y, p.Ty]);
  const AsReqX = (TdesignX * 1e3) / material.fyd;
  const AsReqY = (TdesignY * 1e3) / material.fyd;

  // Step 6
  const zBurst = 0.8 * z;
  const sv = zBurst / Math.max(detailing.numLayers - 1, 1);
  if (sv < 100 || sv > 300) warnings.push({ code: 'SV_RANGE' });
  const as1 = (Math.PI * detailing.barDiameter ** 2) / 4;
  const AsProvX = detailing.numLayers * detailing.legsPerLayerX * as1;
  const AsProvY = detailing.numLayers * detailing.legsPerLayerY * as1;
  const URX = AsReqX / AsProvX;
  const URY = AsReqY / AsProvY;
  if (URX > 1) warnings.push({ code: 'BURST_X_FAIL' });
  if (URY > 1) warnings.push({ code: 'BURST_Y_FAIL' });

  return {
    d, z, selfWeight, nu, sigmaRdMax, Ap, piles: results,
    TdesignX, TdesignY, AsReqX, AsReqY, as1, AsProvX, AsProvY, URX, URY,
    zBurst, sv, zBottomLayer: c + 0.1 * z, warnings,
  };
}
