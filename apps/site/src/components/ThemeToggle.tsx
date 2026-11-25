'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';

/** Light or dark, remembered. The thumb slides on a spring and squashes while pressed; the page follows the system until you choose. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); setReady(true); }, []);
  const flip = () => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; try { localStorage.setItem('osc-theme', next ? 'dark' : 'light'); } catch { /* storage may be blocked */ } };
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" className="tgl" onClick={flip}>
      <motion.span className="th" initial={false} animate={{ x: ready && dark ? 22 : 0 }} whileTap={{ scaleX: 1.3 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
        {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
      </motion.span>
    </button>
  );
}
