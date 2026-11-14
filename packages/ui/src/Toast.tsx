'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';

type Tone = 'ok' | 'info' | 'error';
type T = { id: number; text: string; tone: Tone };
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);
const ICON = { ok: Check, info: Info, error: AlertTriangle } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random();
    setList(l => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), tone === 'error' ? 9000 : 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map(t => { const I = ICON[t.tone]; return <div key={t.id} className={`toast ${t.tone}`}><I size={16} aria-hidden /><span>{t.text}</span></div>; })}
      </div>
    </Ctx.Provider>
  );
}
