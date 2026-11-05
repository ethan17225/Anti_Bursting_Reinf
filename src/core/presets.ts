import type { DesignInput, GeometryInput } from './calculationEngine';

/** TCVN 5574:2018 table 7; fck is the EC2 cylinder strength used for nu'. */
export const CONCRETE_GRADES = [
  { id: 'B25', ec2: 'C20/25', fck: 20, fcd: 14.5 },
  { id: 'B30', ec2: 'C25/30', fck: 25, fcd: 17 },
  { id: 'B35', ec2: 'C30/37', fck: 30, fcd: 19.5 },
  { id: 'B40', ec2: 'C35/45', fck: 35, fcd: 22 },
  { id: 'B45', ec2: 'C40/50', fck: 40, fcd: 25 },
  { id: 'B50', ec2: 'C45/55', fck: 45, fcd: 27.5 },
] as const;
export type GradeId = (typeof CONCRETE_GRADES)[number]['id'];

/** The grade whose design strength matches, else the nearest one. */
export const gradeOf = (fcd: number) =>
  CONCRETE_GRADES.reduce((a, b) => (Math.abs(b.fcd - fcd) < Math.abs(a.fcd - fcd) ? b : a));

export const STEEL_GRADES = [
  { id: 'CB300-V', fyk: 300, fyd: 260 },
  { id: 'CB400-V', fyk: 400, fyd: 350 },
  { id: 'CB500-V', fyk: 500, fyd: 435 },
] as const;

export const BAR_DIAMETERS = [10, 12, 14, 16, 18, 20, 22, 25];
export const LEG_COUNTS = [2, 4, 6, 8];

export type LayoutId = 'P2' | 'P3' | 'P4' | 'P6';
export const LAYOUTS: LayoutId[] = ['P2', 'P3', 'P4', 'P6'];

const EDGE = 150; // mm from pile face to cap edge

/** The cap is drawn centred on its pile group, which sits off the column on eccentric caps (VN_PRESET_06). */
export function capCentre(g: Pick<GeometryInput, 'piles'>) {
  const n = g.piles.length || 1;
  return { x: g.piles.reduce((s, p) => s + p.x, 0) / n, y: g.piles.reduce((s, p) => s + p.y, 0) / n };
}

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

function preset(o: {
  grade: GradeId; steel: 'CB400-V' | 'CB500-V';
  bc: number; hc: number; Lx: number; Ly: number; h: number; c: number; Dp: number;
  piles: Array<[number, number]>;
  NEd: number; MEdx: number; MEdy: number;
  phi: number; layers: number; legsX: number; legsY: number;
}): DesignInput {
  const g = CONCRETE_GRADES.find((x) => x.id === o.grade)!;
  const s = STEEL_GRADES.find((x) => x.id === o.steel)!;
  return {
    material: { standard: 'TCVN_5574_2018', fck: g.fck, fcd: g.fcd, fyk: s.fyk, fyd: s.fyd },
    geometry: {
      Lx: o.Lx, Ly: o.Ly, h: o.h, c: o.c, bc: o.bc, hc: o.hc, Dp: o.Dp, pileShape: 'CIRCULAR',
      piles: o.piles.map(([x, y], i) => ({ id: i + 1, x, y })),
    },
    load: { NEd: o.NEd, MEdx: o.MEdx, MEdy: o.MEdy, includeSelfWeight: false },
    detailing: { barDiameter: o.phi, numLayers: o.layers, legsPerLayerX: o.legsX, legsPerLayerY: o.legsY },
  };
}

export interface VnPreset {
  id: string;
  name: { vi: string; en: string };
  context: { vi: string; en: string };
  input: DesignInput;
}

export const VN_HIGHRISE_PRESETS: VnPreset[] = [
  {
    id: 'VN_PRESET_01',
    name: { vi: 'Chung cư 20–25 tầng · 4 cọc PHC D600', en: '20–25 storey apartments · 4 PHC D600 piles' },
    context: {
      vi: 'Chung cư 22 tầng + 1 hầm trên đất yếu (Bình Dương, Long An, Gia Lâm). Cọc ly tâm PHC-A D600, 240–270 tấn/cọc; dễ ép vỡ thanh chống nếu h < 1500 hoặc bê tông dưới B30.',
      en: '22 storeys + 1 basement on soft ground (Binh Duong, Long An, Gia Lam). Spun PHC-A D600 piles, 240–270 t each; struts crush easily if h < 1500 or concrete is below B30.',
    },
    input: preset({
      grade: 'B30', steel: 'CB400-V', bc: 700, hc: 1100, Lx: 3000, Ly: 3000, h: 1600, c: 180, Dp: 600,
      piles: [[-900, -900], [900, -900], [900, 900], [-900, 900]],
      NEd: 9200, MEdx: 450, MEdy: 300, phi: 16, layers: 4, legsX: 4, legsY: 4,
    }),
  },
  {
    id: 'VN_PRESET_02',
    name: { vi: 'Cao ốc 28–32 tầng · 3 cọc khoan nhồi D1000', en: '28–32 storey tower · 3 bored D1000 piles' },
    context: {
      vi: 'Căn hộ và văn phòng 30 tầng + 2 hầm (Cầu Giấy, Thanh Xuân, Quận 7, Thủ Đức). Tam giác đều cạnh 3Dp: P1 trên trục Y, P2 và P3 lệch 30° trên mặt bằng.',
      en: '30 storeys + 2 basements of flats and offices (Cau Giay, Thanh Xuan, District 7, Thu Duc). Equilateral triangle of side 3Dp: P1 on the Y axis, P2 and P3 at 30° in plan.',
    },
    input: preset({
      grade: 'B35', steel: 'CB400-V', bc: 1000, hc: 1000, Lx: 5000, Ly: 4600, h: 2100, c: 200, Dp: 1000,
      piles: [[0, 1732], [-1500, -866], [1500, -866]],
      NEd: 19500, MEdx: 850, MEdy: 600, phi: 18, layers: 5, legsX: 4, legsY: 4,
    }),
  },
  {
    id: 'VN_PRESET_03',
    name: { vi: 'Tháp 35–40 tầng · 4 cọc khoan nhồi D1200', en: '35–40 storey tower · 4 bored D1200 piles' },
    context: {
      vi: 'Cột giữa tháp 38 tầng + 3–4 hầm, cọc D1200 tựa cuội sỏi hoặc đá phong hóa, 900–1050 tấn/cọc. Lực nén thanh chống lớn, cần lồng thép nhiều lớp φ20–φ22.',
      en: 'Interior column of a 38-storey tower with 3–4 basements, D1200 piles on gravel or weathered rock, 900–1050 t each. Large strut forces need a multi-layer φ20–φ22 cage.',
    },
    input: preset({
      grade: 'B40', steel: 'CB500-V', bc: 1200, hc: 1400, Lx: 6000, Ly: 6000, h: 2600, c: 220, Dp: 1200,
      piles: [[-1800, -1800], [1800, -1800], [1800, 1800], [-1800, 1800]],
      NEd: 36000, MEdx: 1600, MEdy: 1400, phi: 20, layers: 6, legsX: 6, legsY: 6,
    }),
  },
  {
    id: 'VN_PRESET_04',
    name: { vi: 'Đài 2 cọc D1000 · cột biên / vách cứng', en: '2-pile D1000 cap · edge column / core wall' },
    context: {
      vi: 'Đài 2 cọc dưới cột biên hoặc cánh vách nhà 25–30 tầng. Lực truyền trong mặt phẳng X–Z (T_burst,Y = 0), thép phương Y chỉ cấu tạo ôm lồng.',
      en: '2-pile cap under an edge column or core wall flange of a 25–30 storey building. Load flows in the X–Z plane (T_burst,Y = 0); Y bars only tie the cage.',
    },
    input: preset({
      grade: 'B35', steel: 'CB400-V', bc: 600, hc: 1500, Lx: 5000, Ly: 2200, h: 2000, c: 200, Dp: 1000,
      piles: [[-1500, 0], [1500, 0]],
      NEd: 13500, MEdx: 0, MEdy: 1100, phi: 16, layers: 5, legsX: 4, legsY: 2,
    }),
  },
  {
    id: 'VN_PRESET_05',
    name: { vi: 'Tháp 45+ tầng · 6 cọc D1200 dưới cột Mega', en: '45+ storey tower · 6 D1200 piles under a mega column' },
    context: {
      vi: 'Trụ Mega của tháp 45 tầng, lưới cọc 3 × 2. Hai cọc giữa có thanh chống dốc, bốn cọc góc thoải nên lực bứt tách phương X tăng mạnh. Cấu hình ban đầu không đạt: bấm Auto-Fix.',
      en: 'Mega column of a 45-storey tower on a 3 × 2 pile grid. The two middle struts are steep, the four corner struts flat, so X bursting rises sharply. The starting design fails: try Auto-Fix.',
    },
    input: preset({
      grade: 'B40', steel: 'CB500-V', bc: 1600, hc: 1200, Lx: 9600, Ly: 6000, h: 2800, c: 250, Dp: 1200,
      piles: [[-3600, -1800], [0, -1800], [3600, -1800], [-3600, 1800], [0, 1800], [3600, 1800]],
      NEd: 50000, MEdx: 2500, MEdy: 4200, phi: 20, layers: 6, legsX: 6, legsY: 6,
    }),
  },
  {
    id: 'VN_PRESET_06',
    name: { vi: 'Nhà xen cấy 18 tầng · 4 cọc lệch tâm sát tường vây', en: '18 storey infill · 4 eccentric piles by the diaphragm wall' },
    context: {
      vi: 'Khách sạn / văn phòng 18 tầng chen trong nội đô (Quận 1, Quận 3, Hoàn Kiếm). Cột biên sát tường vây, cọc D800 lệch về phía +X: thanh chống phải dốc, thanh chống trái vươn dài.',
      en: '18-storey hotel or office infill in the city centre (District 1, District 3, Hoan Kiem). Edge column against the diaphragm wall, D800 piles shifted to +X: steep right struts, long left struts.',
    },
    input: preset({
      grade: 'B35', steel: 'CB400-V', bc: 800, hc: 800, Lx: 4200, Ly: 3800, h: 1900, c: 180, Dp: 800,
      piles: [[-600, 1200], [-600, -1200], [1800, 1200], [1800, -1200]],
      NEd: 12800, MEdx: 400, MEdy: 2800, phi: 16, layers: 4, legsX: 4, legsY: 4,
    }),
  },
];

export const DEFAULT_INPUT: DesignInput = VN_HIGHRISE_PRESETS[0].input;
