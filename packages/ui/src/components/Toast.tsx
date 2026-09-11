'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'neutral' | 'accent' | 'warning' | 'danger';

export type ToastOptions = { tone?: ToastTone; duration?: number };

type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastApi = { toast: (message: string, opts?: ToastOptions) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast api. Must be called under a `<ToastProvider>`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

/** Provides `useToast()` and renders the toast viewport (`.toast-viewport`). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = idRef.current++;
      setItems((cur) => [...cur, { id, message, tone: opts?.tone ?? 'neutral' }]);
      window.setTimeout(() => remove(id), opts?.duration ?? 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <span>{t.message}</span>
            <button
              className="toast-close"
              type="button"
              aria-label="Dismiss"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
