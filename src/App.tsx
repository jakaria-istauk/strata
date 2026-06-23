import { Database } from 'lucide-react';
import { setTheme, getTheme } from './lib/theme';

// Phase 1 scaffold placeholder. Real Explorer shell lands in Phase 3.
export default function App() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-md text-on-surface">
      <div className="flex items-center gap-sm">
        <Database className="text-primary" size={32} />
        <h1 className="font-display text-2xl font-bold text-primary">Strata</h1>
      </div>
      <p className="text-on-surface-variant text-sm">React SPA scaffold · Phase 1</p>
      <div className="flex gap-sm">
        {(['light', 'dark', 'system'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTheme(m)}
            className={`px-md py-sm rounded-lg border border-outline-variant capitalize transition-colors hover:bg-surface-container-high ${
              getTheme() === m ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
