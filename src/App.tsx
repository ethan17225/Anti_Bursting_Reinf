import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Languages, PencilRuler } from 'lucide-react';
import { calculate, type DesignInput, type Viewer3DConfig } from './core/calculationEngine';
import { DEFAULT_INPUT } from './core/presets';
import { LangContext, useT, type Lang } from './i18n';
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

function Dashboard() {
  const t = useT();
  const [input, setInput] = useState<DesignInput>(DEFAULT_INPUT);
  const [view, setView] = useState<Viewer3DConfig>(DEFAULT_VIEW);
  const [tab, setTab] = useState<'3d' | '2d'>('3d');
  const [showReport, setShowReport] = useState(false);
  const result = useMemo(() => calculate(input), [input]);
  const selectPile = (id: number | null) => setView((v) => ({ ...v, selectedPileId: v.selectedPileId === id ? null : id }));

  return (
    <>
      <div className="no-print flex min-h-full flex-col xl:h-full">
        <Header />
        <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(320px,1fr)_2fr] xl:min-h-0 xl:grid-cols-[28fr_44fr_28fr]">
          <aside className="card overflow-y-auto xl:min-h-0">
            <InputPanel input={input} onChange={setInput} />
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
                  <PileCapScene3D input={input} result={result} view={view} onViewChange={setView} onSelectPile={selectPile} />
                </Suspense>
              ) : (
                <div className="absolute inset-0 bg-white p-4">
                  <Section2D input={input} result={result} />
                </div>
              )}
            </div>
          </section>
          <aside className="card overflow-y-auto lg:col-span-2 xl:col-span-1 xl:min-h-0">
            <ResultsPanel result={result} selectedPileId={view.selectedPileId} onSelectPile={selectPile} onPrint={() => setShowReport(true)} />
          </aside>
        </main>
      </div>
      {showReport && <Report input={input} result={result} onClose={() => setShowReport(false)} />}
    </>
  );
}

function Header() {
  const t = useT();
  return (
    <LangContext.Consumer>
      {({ lang, setLang }) => (
        <header className="flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-2.5">
          <div>
            <h1 className="text-lg leading-tight">{t('appTitle')}</h1>
            <p className="text-xs text-muted">{t('appSubtitle')}</p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Language">
            <Languages size={16} className="text-muted" />
            {(['vi', 'en'] as const).map((l) => (
              <button key={l} className="btn uppercase" aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l}
              </button>
            ))}
          </div>
        </header>
      )}
    </LangContext.Consumer>
  );
}
