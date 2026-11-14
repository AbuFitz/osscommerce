'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { Check, Info } from 'lucide-react';

type T = { id: number; text: string; tone: 'ok' | 'info' };
const Ctx = createContext<(text: string, tone?: T['tone']) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string, tone: T['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setList(l => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map(t => <div key={t.id} className="toast">{t.tone === 'ok' ? <Check size={16} aria-hidden /> : <Info size={16} aria-hidden />}<span>{t.text}</span></div>)}
      </div>
    </Ctx.Provider>
  );
}
