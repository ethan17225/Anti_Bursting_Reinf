import type { DesignInput, DesignResult } from '../core/calculationEngine';
import { fmt } from '../core/format';
import { capCentre } from '../core/presets';

/** Elevation through the column centre along X, drawn in mm (SVG y = -z). */
export default function Section2D({ input, result: r }: { input: DesignInput; result: DesignResult }) {
  const { Lx, h, c, bc, Dp } = input.geometry;
  const { numLayers, legsPerLayerY, barDiameter } = input.detailing;
  const u = Math.max(Lx, h) / 100;
  const font = u * 3;
  const colH = 500;
  const pileL = 500;
  const LX = Lx - 150;
  const layers = Array.from({ length: numLayers }, (_, k) => r.zBottomLayer + k * r.sv);
  const xs = [...new Set(input.geometry.piles.map((p) => p.x))];
  const struts = [...new Map(r.piles.filter((p) => p.active).map((p) => [`${p.x}|${p.xc}`, p])).values()];
  const cx = capCentre(input.geometry).x;
  const barXs = Array.from({ length: legsPerLayerY }, (_, j) => cx + (legsPerLayerY === 1 ? 0 : -LX / 2 + (j * LX) / (legsPerLayerY - 1)));

  const dimX0 = cx + Lx / 2 + 6 * u;
  const dims: Array<[string, number, number]> = [
    [`h = ${fmt(h, 0)}`, 0, h],
    [`d = ${fmt(r.d, 0)}`, c, h],
    [`z = ${fmt(r.z, 1)}`, c, c + r.z],
    [`z_burst = ${fmt(r.zBurst, 1)}`, r.zBottomLayer, r.zBottomLayer + r.zBurst],
  ];
  const left = cx - Lx / 2;
  const minX = Math.min(left, -bc / 2) - 14 * u;
  const maxX = dimX0 + dims.length * 12 * u + 4 * u;
  const minZ = -pileL - 4 * u;
  const maxZ = h + colH + 4 * u;

  return (
    <svg viewBox={`${minX} ${-maxZ} ${maxX - minX} ${maxZ - minZ}`} className="h-full w-full" role="img" aria-label="Pile cap section">
      <g fill="none" stroke="#333231" strokeWidth={u * 0.25}>
        <rect x={left} y={-h} width={Lx} height={h} fill="#e4e1dd" />
        <rect x={-bc / 2} y={-h - colH} width={bc} height={colH} fill="#e4e1dd" />
        {xs.map((x) => <rect key={x} x={x - Dp / 2} y={0} width={Dp} height={pileL} fill="#e4e1dd" />)}
      </g>
      <g stroke="#625f5b" strokeWidth={u * 0.15} strokeDasharray={`${u} ${u}`}>
        <line x1={left} x2={left + Lx} y1={-c} y2={-c} />
        <line x1={left} x2={left + Lx} y1={-(c + r.z)} y2={-(c + r.z)} />
      </g>
      {struts.map((p) => (
        <line key={p.id} x1={p.xc} y1={-(c + r.z)} x2={p.x} y2={-c} stroke="#f97316" strokeWidth={p.bef * 0.25} strokeOpacity={0.45} strokeLinecap="round" />
      ))}
      {layers.map((zk) => (
        <g key={zk}>
          <line x1={cx - LX / 2} x2={cx + LX / 2} y1={-zk} y2={-zk} stroke="#2563eb" strokeWidth={Math.max(barDiameter, u * 0.4)} />
          {barXs.map((x) => <circle key={x} cx={x} cy={-zk} r={Math.max(barDiameter, u * 0.5)} fill="#0891b2" />)}
        </g>
      ))}

      <g stroke="#333231" strokeWidth={u * 0.15} fill="#333231" fontSize={font} fontFamily="JetBrains Mono, monospace">
        {dims.map(([label, z1, z2], i) => <DimV key={label} x={dimX0 + i * 12 * u} z1={z1} z2={z2} label={label} u={u} />)}
        <DimV x={left - 6 * u} z1={0} z2={c} label={`c = ${fmt(c, 0)}`} u={u} />
        {layers.length > 1 && <DimV x={left - 6 * u} z1={layers[0]} z2={layers[1]} label={`s_v = ${fmt(r.sv, 0)}`} u={u} />}
        <text x={0} y={-h - colH - u} textAnchor="middle" stroke="none">
          {numLayers} × ({input.detailing.legsPerLayerX}+{legsPerLayerY}) φ{barDiameter} · Lx = {fmt(Lx, 0)}
        </text>
      </g>
    </svg>
  );
}

function DimV({ x, z1, z2, label, u }: { x: number; z1: number; z2: number; label: string; u: number }) {
  const t = u * 1.2;
  return (
    <g>
      <line x1={x} x2={x} y1={-z1} y2={-z2} />
      <line x1={x - t} x2={x + t} y1={-z1 + t} y2={-z1 - t} />
      <line x1={x - t} x2={x + t} y1={-z2 + t} y2={-z2 - t} />
      <text x={x - u} y={-(z1 + z2) / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${x - u} ${-(z1 + z2) / 2})`}>
        {label}
      </text>
    </g>
  );
}
