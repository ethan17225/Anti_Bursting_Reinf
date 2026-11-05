import { lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { Box, Cloud, Languages, Moon, PencilRuler, Sun, Wand2 } from 'lucide-react';
import { calculate, type DesignInput, type Viewer3DConfig } from './core/calculationEngine';
import { costOf, DEFAULT_VN_COST_RATES, type CostUnitRates, type OptimizationCandidate } from './core/costOptimizer';
import { fmt, money } from './core/format';
import { BAR_DIAMETERS, DEFAULT_INPUT } from './core/presets';
import { LangContext, useT, type Key, type Lang } from './i18n';
import { supabase } from './lib/supabase';
import AutoFixPanel from './components/AutoFixPanel';
import CloudPanel, { type CurrentDesign } from './components/CloudPanel';
import InputPanel from './components/InputPanel';
import ResultsPanel from './components/ResultsPanel';
import Section2D from './components/Section2D';
import Report from './components/Report';

const PileCapScene3D = lazy(() => import('./components/viewer3d/PileCapScene3D'));

const DEFAULT_VIEW: Viewer3DConfig = {
  showConcreteShell: true,
  showStrutAndTie: true,
  showBottleBulge: true,
  showBurstingArrows: true,
  showRebarCage: true,
  showLabels: true,
  cameraMode: 'PERSPECTIVE',
  selectedPileId: null,
};

type Theme = 'dark' | 'light';

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('lang') === 'en' ? 'en' : 'vi'));
  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Dashboard />
    </LangContext.Provider>
  );
}

const CAMERA_KEYS: Viewer3DConfig['cameraMode'][] = ['PERSPECTIVE', 'ORTHO_TOP', 'ORTHO_FRONT', 'ORTHO_SIDE'];
const VIEW_KEYS: Record<string, keyof Viewer3DConfig> = { x: 'showConcreteShell', b: 'showBottleBulge', r: 'showRebarCage' };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Dashboard() {
  const t = useT();
  const { lang } = useContext(LangContext);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') === 'light' ? 'light' : 'dark'));
  const [input, setInput] = useState<DesignInput>(DEFAULT_INPUT);
  const [preview, setPreview] = useState<DesignInput | null>(null);
  const [view, setView] = useState<Viewer3DConfig>(DEFAULT_VIEW);
  const [tab, setTab] = useState<'3d' | '2d'>('3d');
  const [showReport, setShowReport] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [showAutoFix, setShowAutoFix] = useState(false);
  const [rates, setRates] = useState<CostUnitRates>(DEFAULT_VN_COST_RATES);
  const [toast, setToast] = useState<string | null>(null);
  const [current, setCurrent] = useState<CurrentDesign | null>(null);
  const result = useMemo(() => calculate(input), [input]);
  const previewResult = useMemo(() => preview && calculate(preview), [preview]);
  const shown = preview ?? input;
  const shownResult = previewResult ?? result;
  const selectPile = (id: number | null) => setView((v) => ({ ...v, selectedPileId: v.selectedPileId === id ? null : id }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, select, textarea, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      const edit = setInput;
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const dh = e.key === 'ArrowUp' ? 50 : -50;
        edit((i) => ({ ...i, geometry: { ...i.geometry, h: Math.max(i.geometry.c + 300, i.geometry.h + dh) } }));
      } else if (k >= '1' && k <= '4') {
        setView((v) => ({ ...v, cameraMode: CAMERA_KEYS[Number(k) - 1] }));
      } else if (VIEW_KEYS[k]) {
        setView((v) => ({ ...v, [VIEW_KEYS[k]]: !v[VIEW_KEYS[k]] }));
      } else if (k === '[' || k === ']') {
        edit((i) => {
          const j = clamp(BAR_DIAMETERS.indexOf(i.detailing.barDiameter) + (k === ']' ? 1 : -1), 0, BAR_DIAMETERS.length - 1);
          return { ...i, detailing: { ...i.detailing, barDiameter: BAR_DIAMETERS[j] } };
        });
      } else if (k === '-' || k === '=') {
        edit((i) => ({ ...i, detailing: { ...i.detailing, numLayers: clamp(i.detailing.numLayers + (k === '=' ? 1 : -1), 2, 10) } }));
      } else if (k === 'a') {
        setShowAutoFix((s) => !s);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const apply = (c: OptimizationCandidate) => {
    const before = costOf(input, result, rates);
    const after = costOf(c.input, calculate(c.input), rates);
    const dCost = after.total - before.total;
    const dSteel = after.burstingSteelMassKg - before.burstingSteelMassKg;
    setInput(c.input);
    setPreview(null);
    setToast(`${t('applied')} · ${t('costLabel')} ${money(dCost, lang, true)} · ${t('burstSteel')} ${dSteel > 0 ? '+' : ''}${fmt(dSteel, 0)} kg`);
  };

  return (
    <>
      <div className="no-print flex min-h-full flex-col xl:h-full">
        <Header designName={current?.name} theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onAutoFix={() => setShowAutoFix((s) => !s)} autoFixOpen={showAutoFix}
          onOpenCloud={supabase ? () => setShowCloud(true) : undefined} />
        <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(320px,1fr)_2fr] xl:min-h-0 xl:grid-cols-[28fr_44fr_28fr]">
          <aside className="card overflow-y-auto xl:min-h-0">
            {showAutoFix ? (
              <AutoFixPanel input={input} rates={rates} onRatesChange={setRates} onPreview={setPreview} onApply={apply}
                onClose={() => { setShowAutoFix(false); setPreview(null); }} />
            ) : (
              <InputPanel input={input} sv={result.sv} onChange={setInput} />
            )}
          </aside>
          <section className="card flex min-h-[560px] flex-col overflow-hidden xl:min-h-0">
            <div className="flex gap-1 border-b border-line p-2">
              <button className="btn" aria-pressed={tab === '3d'} onClick={() => setTab('3d')}>
                <Box size={14} /> {t('tab3d')}
              </button>
              <button className="btn" aria-pressed={tab === '2d'} onClick={() => setTab('2d')}>
                <PencilRuler size={14} /> {t('tab2d')}
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              {tab === '3d' ? (
                <Suspense fallback={null}>
                  <PileCapScene3D input={shown} result={shownResult} view={view} dark={theme === 'dark'} onViewChange={setView} onSelectPile={selectPile} />
                </Suspense>
              ) : (
                <div className="absolute inset-0 bg-white p-4">
                  <Section2D input={shown} result={shownResult} />
                </div>
              )}
              {preview && (
                <div className="pointer-events-none absolute bottom-3 left-3 animate-pulse rounded-sm border border-accent bg-panel/90 px-2 py-1 font-mono text-[11px] font-medium tracking-wider text-accent">
                  {t('previewing')}
                </div>
              )}
            </div>
          </section>
          <aside className="card overflow-y-auto lg:col-span-2 xl:col-span-1 xl:min-h-0">
            <ResultsPanel result={shownResult} baseline={previewResult ? result : undefined} selectedPileId={view.selectedPileId}
              onSelectPile={selectPile} onPrint={() => setShowReport(true)} />
          </aside>
        </main>
        <StatusBar />
      </div>
      {toast && (
        <div role="status" className="no-print fixed right-4 bottom-10 z-40 max-w-md rounded-md border border-accent bg-panel px-3 py-2 font-mono text-xs text-ink shadow-lg">
          {toast}
        </div>
      )}
      {showReport && <Report input={input} result={result} onClose={() => setShowReport(false)} />}
      {showCloud && (
        <CloudPanel input={input} current={current} onSaved={setCurrent} onClose={() => setShowCloud(false)}
          onLoad={(loaded, design) => { setInput(loaded); setCurrent(design); }} />
      )}
    </>
  );
}

const HOTKEYS: Array<[string, Key | string]> = [
  ['1–4', 'hkCamera'],
  ['X B R', 'hkToggles'],
  ['[ ]', 'φ'],
  ['- =', 'hkLayers'],
  ['⇧↑ ⇧↓', 'h ±50'],
  ['A', 'hkAuto'],
];

function StatusBar() {
  const t = useT();
  const label = (k: string) => (k.startsWith('hk') ? t(k as Key) : k);
  return (
    <footer className="hidden flex-wrap gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-1.5 text-[11px] text-muted md:flex">
      {HOTKEYS.map(([keys, k]) => (
        <span key={keys} className="inline-flex items-center gap-1">
          {keys.split(' ').map((key) => <kbd key={key}>{key}</kbd>)} {label(k)}
        </span>
      ))}
    </footer>
  );
}

function Header({ designName, theme, onToggleTheme, onAutoFix, autoFixOpen, onOpenCloud }: {
  designName?: string;
  theme: Theme;
  onToggleTheme: () => void;
  onAutoFix: () => void;
  autoFixOpen: boolean;
  onOpenCloud?: () => void;
}) {
  const t = useT();
  const { lang, setLang } = useContext(LangContext);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="truncate text-lg leading-tight">{t('appTitle')}</h1>
        <p className="truncate text-xs text-muted">{t('appSubtitle')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button className="btn btn-primary mr-1" aria-pressed={autoFixOpen} onClick={onAutoFix}>
          <Wand2 size={14} /> {t('autoFix')} <kbd>A</kbd>
        </button>
        {onOpenCloud && (
          <button className="btn mr-1 max-w-64" onClick={onOpenCloud}>
            <Cloud size={14} /> <span className="truncate">{designName ?? t('cloud')}</span>
          </button>
        )}
        <button className="btn mr-1" onClick={onToggleTheme} aria-label={t('theme')} title={t('theme')}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <Languages size={16} className="text-muted" />
        {(['vi', 'en'] as const).map((l) => (
          <button key={l} className="btn uppercase" aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l}
          </button>
        ))}
      </div>
    </header>
  );
}
