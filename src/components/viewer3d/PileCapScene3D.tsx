import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Cone, Cylinder, Edges, GizmoHelper, GizmoViewport, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { DesignInput, DesignResult, PileResult, Viewer3DConfig } from '../../core/calculationEngine';
import { useT, type Key } from '../../i18n';
import { fmt } from '../../core/format';
import { capCentre } from '../../core/presets';

/** Structural (x, y, z) in mm, z up -> three.js metres, Y up. */
const to3D = (x: number, y: number, z: number) => new THREE.Vector3(x * 0.001, z * 0.001, -y * 0.001);

const Y_UP = new THREE.Vector3(0, 1, 0);
const AMBER = new THREE.Color('#f59e0b');
const ORANGE = new THREE.Color('#ea580c');
const crushColor = (ur: number) => (ur > 1 ? '#ef4444' : `#${AMBER.clone().lerp(ORANGE, Math.max(0, ur)).getHexString()}`);

function XRayMaterial() {
  return <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.16} depthWrite={false} roughness={0.2} />;
}

function Concrete({ g, edge }: { g: DesignInput['geometry']; edge: string }) {
  const m = 0.001;
  const colH = 800;
  const pileL = 1000;
  const cap = capCentre(g);
  return (
    <group>
      <mesh position={to3D(cap.x, cap.y, g.h / 2)} renderOrder={1}>
        <boxGeometry args={[g.Lx * m, g.h * m, g.Ly * m]} />
        <XRayMaterial />
        <Edges threshold={15} color={edge} />
      </mesh>
      <mesh position={[0, (g.h + colH / 2) * m, 0]} renderOrder={1}>
        <boxGeometry args={[g.bc * m, colH * m, g.hc * m]} />
        <XRayMaterial />
        <Edges threshold={15} color={edge} />
      </mesh>
      {g.piles.map((p) => (
        <mesh key={p.id} position={to3D(p.x, p.y, -pileL / 2)} renderOrder={1}>
          {g.pileShape === 'CIRCULAR'
            ? <cylinderGeometry args={[(g.Dp * m) / 2, (g.Dp * m) / 2, pileL * m, 32]} />
            : <boxGeometry args={[g.Dp * m, pileL * m, g.Dp * m]} />}
          <XRayMaterial />
          <Edges threshold={15} color={edge} />
        </mesh>
      ))}
    </group>
  );
}

function strutFrame(p: PileResult, c: number, z: number) {
  const start = to3D(p.xc, p.yc, c + z);
  const end = to3D(p.x, p.y, c);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const unit = dir.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_UP, unit);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  return { start, end, unit, length, quaternion, mid };
}

function BottleStrut3D({ p, frame, showBulge, dimmed, selected, onSelect }: {
  p: PileResult;
  frame: ReturnType<typeof strutFrame>;
  showBulge: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const rEnd = 0.5 * p.bef * 0.001;
  const rMid = 0.5 * p.bspread * 0.001;
  const L = frame.length;
  const color = crushColor(p.URcrush);
  return (
    <group position={frame.mid} quaternion={frame.quaternion}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <cylinderGeometry args={[rEnd, rEnd, L, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.1}
          transparent={dimmed} opacity={dimmed ? 0.2 : 1} />
      </mesh>
      {showBulge && (
        <>
          <mesh position={[0, L / 4, 0]} renderOrder={2}>
            <cylinderGeometry args={[rEnd, rMid, L / 2, 24, 4, true]} />
            <meshBasicMaterial color="#fb923c" wireframe transparent opacity={dimmed ? 0.08 : 0.28} depthWrite={false} />
          </mesh>
          <mesh position={[0, -L / 4, 0]} renderOrder={2}>
            <cylinderGeometry args={[rMid, rEnd, L / 2, 24, 4, true]} />
            <meshBasicMaterial color="#fb923c" wireframe transparent opacity={dimmed ? 0.08 : 0.28} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

function BurstingArrows3D({ frame, offset, length }: { frame: ReturnType<typeof strutFrame>; offset: number; length: number }) {
  const n = frame.unit.clone().cross(frame.unit.clone().cross(Y_UP));
  if (n.lengthSq() < 1e-9) return null;
  n.normalize();
  const head = 0.08;
  return (
    <>
      {[1, -1].map((s) => {
        const dirN = n.clone().multiplyScalar(s);
        const q = new THREE.Quaternion().setFromUnitVectors(Y_UP, dirN);
        const shaftMid = frame.mid.clone().addScaledVector(dirN, offset + length / 2);
        const tip = frame.mid.clone().addScaledVector(dirN, offset + length + head / 2);
        return (
          <group key={s}>
            <Cylinder args={[0.012, 0.012, length, 8]} position={shaftMid} quaternion={q}>
              <meshBasicMaterial color="#dc2626" />
            </Cylinder>
            <Cone args={[0.035, head, 12]} position={tip} quaternion={q}>
              <meshBasicMaterial color="#dc2626" />
            </Cone>
          </group>
        );
      })}
    </>
  );
}

function AntiBurstingCage3D({ g, d, r }: { g: DesignInput['geometry']; d: DesignInput['detailing']; r: DesignResult }) {
  const cSide = 75;
  const LX = g.Lx - 2 * cSide;
  const LY = g.Ly - 2 * cSide;
  const rad = (d.barDiameter * 0.001) / 2;
  const spread = (n: number, L: number) => Array.from({ length: n }, (_, j) => (n === 1 ? 0 : -L / 2 + (j * L) / (n - 1)));
  const layers = Array.from({ length: d.numLayers }, (_, k) => r.zBottomLayer + k * r.sv);
  const cap = capCentre(g);
  return (
    <group position={to3D(cap.x, cap.y, 0)}>
      {layers.map((zk) => (
        <group key={zk}>
          {spread(d.legsPerLayerX, LY).map((y) => (
            <mesh key={`x${y}`} position={to3D(0, y, zk)} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[rad, rad, LX * 0.001, 8]} />
              <meshStandardMaterial color="#3b82f6" />
            </mesh>
          ))}
          {spread(d.legsPerLayerY, LX).map((x) => (
            <mesh key={`y${x}`} position={to3D(x, 0, zk)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[rad, rad, LY * 0.001, 8]} />
              <meshStandardMaterial color="#06b6d4" />
            </mesh>
          ))}
          <Line color="#3b82f6" lineWidth={2}
            points={[[-LX / 2, -LY / 2], [LX / 2, -LY / 2], [LX / 2, LY / 2], [-LX / 2, LY / 2], [-LX / 2, -LY / 2]].map(([x, y]) => to3D(x, y, zk))} />
        </group>
      ))}
    </group>
  );
}

function Cameras({ mode, span, cy }: { mode: Viewer3DConfig['cameraMode']; span: number; cy: number }) {
  const far = span * 4;
  const zoom = 260 / span;
  const target: [number, number, number] = [0, cy, 0];
  return (
    <>
      {mode === 'PERSPECTIVE' && <PerspectiveCamera key={mode} makeDefault fov={40} position={[span * 1.25, cy + span * 0.9, span * 1.45]} />}
      {mode === 'ORTHO_TOP' && <OrthographicCamera key={mode} makeDefault zoom={zoom} up={[0, 0, -1]} position={[0, far, 0]} />}
      {mode === 'ORTHO_FRONT' && <OrthographicCamera key={mode} makeDefault zoom={zoom} position={[0, cy, far]} />}
      {mode === 'ORTHO_SIDE' && <OrthographicCamera key={mode} makeDefault zoom={zoom} position={[far, cy, 0]} />}
      <OrbitControls key={`c${mode}`} makeDefault target={target} enableRotate={mode === 'PERSPECTIVE'} />
    </>
  );
}

const TOGGLES: Array<[keyof Viewer3DConfig, Key]> = [
  ['showConcreteShell', 'tShell'],
  ['showStrutAndTie', 'tStm'],
  ['showBottleBulge', 'tStruts'],
  ['showBurstingArrows', 'tArrows'],
  ['showRebarCage', 'tCage'],
  ['showLabels', 'tLabels'],
];
const CAMS: Array<[Viewer3DConfig['cameraMode'], Key]> = [
  ['PERSPECTIVE', 'camIso'],
  ['ORTHO_TOP', 'camTop'],
  ['ORTHO_FRONT', 'camFront'],
  ['ORTHO_SIDE', 'camSide'],
];

export default function PileCapScene3D({ input, result, view, dark, onViewChange, onSelectPile }: {
  input: DesignInput;
  dark: boolean;
  result: DesignResult;
  view: Viewer3DConfig;
  onViewChange: (v: Viewer3DConfig) => void;
  onSelectPile: (id: number | null) => void;
}) {
  const t = useT();
  const g = input.geometry;
  const active = result.piles.filter((p) => p.active);
  const frames = new Map(active.map((p) => [p.id, strutFrame(p, g.c, result.z)]));
  const maxT = Math.max(1, ...active.map((p) => p.Tperp));
  const span = Math.max(g.Lx, g.Ly, g.h + 1800) * 0.001;

  return (
    <div className="absolute inset-0 bg-viewport">
      <Canvas onPointerMissed={() => onSelectPile(null)}>
        <Cameras mode={view.cameraMode} span={span} cy={(g.h * 0.001) / 2} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 8, 5]} intensity={1.6} />
        {view.showConcreteShell && <Concrete g={g} edge={dark ? '#64748b' : '#334155'} />}
        {view.showRebarCage && <AntiBurstingCage3D g={g} d={input.detailing} r={result} />}
        {active.map((p) => {
          const f = frames.get(p.id)!;
          const dimmed = view.selectedPileId !== null && view.selectedPileId !== p.id;
          return (
            <group key={p.id}>
              {view.showStrutAndTie && (
                <>
                  <BottleStrut3D p={p} frame={f} showBulge={view.showBottleBulge} dimmed={dimmed}
                    selected={view.selectedPileId === p.id} onSelect={() => onSelectPile(p.id)} />
                  <Line points={[to3D(p.xc, p.yc, g.c), f.end]} color={dark ? '#94a3b8' : '#334155'} lineWidth={3} />
                </>
              )}
              {view.showBurstingArrows && !dimmed && p.a > 0 && (
                <BurstingArrows3D frame={f} length={0.12 + (0.3 * p.Tperp) / maxT}
                  offset={0.5 * 0.001 * (view.showBottleBulge ? p.bspread : p.bef)} />
              )}
              {view.showLabels && !dimmed && (
                <Html position={f.mid} distanceFactor={6} center zIndexRange={[10, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-sm border border-line bg-panel/95 px-1.5 py-1 font-mono text-[10px] leading-tight text-ink shadow-sm">
                    <b>P{p.id}</b> θ {fmt(p.theta, 1)}°<br />
                    Fc {fmt(p.Fc, 0)} kN<br />
                    T⊥ {fmt(p.Tperp, 0)} kN
                  </div>
                </Html>
              )}
            </group>
          );
        })}
        <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
          <GizmoViewport labels={['X', 'Z', '-Y']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      <div className="absolute top-2 right-2 flex max-w-[min(100%-1rem,30rem)] flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-1">
          {TOGGLES.map(([k, label]) => (
            <button key={k} className="btn" aria-pressed={view[k] as boolean} onClick={() => onViewChange({ ...view, [k]: !view[k] })}>
              {t(label)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {CAMS.map(([mode, label]) => (
            <button key={mode} className="btn" aria-pressed={view.cameraMode === mode} onClick={() => onViewChange({ ...view, cameraMode: mode })}>
              {t(label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
