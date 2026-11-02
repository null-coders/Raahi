import { MotionConfig } from 'framer-motion';
import { Component, lazy, Suspense, useEffect, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { BottomNav } from './components/Layout';
import { CompassLoader } from './components/ui';
import Home from './pages/Home';

/**
 * Lazy page that survives a new deploy: if the browser still holds the old page and asks for a chunk
 * that no longer exists, reload once to pick up the new files instead of showing a blank screen.
 */
function page<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => { try { sessionStorage.removeItem('raahi.reloaded'); } catch { /* storage blocked */ } return m; })
      .catch((err) => {
        let reloaded = false;
        try { reloaded = sessionStorage.getItem('raahi.reloaded') === '1'; sessionStorage.setItem('raahi.reloaded', '1'); } catch { /* storage blocked */ }
        if (!reloaded) { window.location.reload(); return new Promise<never>(() => {}); }
        throw err;
      }),
  );
}

const Destination = page(() => import('./pages/Destination'));
const Planner = page(() => import('./pages/Planner'));
const Trip = page(() => import('./pages/Trip'));
const Decided = page(() => import('./pages/Decided'));
const PlacePage = page(() => import('./pages/PlacePage'));
const Saved = page(() => import('./pages/Saved'));
const AddPlace = page(() => import('./pages/AddPlace'));

/** New pages open at the top; Back/Forward leave the browser to restore where you were. */
function ScrollManager() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, type]);
  return null;
}

/** A crash in one page must never leave a blank screen: show a way back instead. */
class PageBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Raahi page error', error, info.componentStack); }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <CompassLoader size={64} />
          <h1 className="h-display mt-6 text-3xl">Something went off route</h1>
          <p className="mt-2 text-ink-soft">This page hit a snag. Reloading usually fixes it.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-ink" onClick={() => window.location.reload()}>Reload</button>
            <Link className="btn-ghost" to="/" onClick={() => this.setState({ error: null })}>Go home</Link>
          </div>
        </div>
      </main>
    );
  }
}

const Fallback = () => <div className="grid min-h-screen place-items-center"><CompassLoader /></div>;

export default function App() {
  const location = useLocation();
  // No exit-then-enter ("wait") route transition here: with lazy pages and quick Back/Forward taps it
  // could get stuck between the old page leaving and the new one arriving, leaving a blank screen.
  // Each page fades in on its own (see <Page>).
  return (
    <MotionConfig reducedMotion="user">
      <ScrollManager />
      <PageBoundary resetKey={location.pathname + location.search}>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/d/:id" element={<Destination />} />
            <Route path="/p/:id" element={<PlacePage />} />
            <Route path="/plan" element={<Planner />} />
            <Route path="/trip" element={<Trip />} />
            <Route path="/decided" element={<Decided />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/add" element={<AddPlace />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </PageBoundary>
      <BottomNav />
    </MotionConfig>
  );
}
