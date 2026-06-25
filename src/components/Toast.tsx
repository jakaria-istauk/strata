// Minimal toast system — ToastProvider + useToast(). Auto-dismiss after 3.5s.

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, kind, message }]);
      // Errors linger longer (and are read-worthy); successes dismiss quickly.
      setTimeout(() => remove(id), kind === 'error' ? 7000 : 3500);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* z above the drawer overlay (z-50 / wp 100000) and wpadminbar (99999). */}
      <div className="pointer-events-none fixed bottom-lg right-lg z-[100003] flex flex-col gap-sm">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : AlertCircle;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex max-w-sm items-start gap-sm rounded-lg border px-md py-sm text-sm shadow-xl ${
                t.kind === 'success'
                  ? 'border-outline-variant bg-surface text-on-surface'
                  : 'border-error/40 bg-surface text-on-surface'
              }`}
            >
              <Icon
                size={16}
                className={`mt-0.5 shrink-0 ${t.kind === 'success' ? 'text-primary' : 'text-error'}`}
              />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 text-on-surface-variant hover:text-on-surface"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
