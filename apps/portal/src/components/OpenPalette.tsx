'use client';
import { Search } from 'lucide-react';
import { useModKey } from './CommandPalette';

/** The search pill in the top bar. It opens the command palette; it is a button, not a form. */
export function OpenPalette() {
  const mod = useModKey();
  return <button type="button" className="searchpill" onClick={() => dispatchEvent(new Event('oss:palette'))} aria-label={`Search and jump. Shortcut: ${mod === '⌘' ? 'Command' : 'Control'} K, or slash`}><Search size={16} aria-hidden /><span>Search orders, products, customers</span><kbd aria-hidden>{mod}{mod === '⌘' ? '' : ' '}K</kbd></button>;
}

export function PaletteIcon() {
  return <button type="button" className="iconbtn" onClick={() => dispatchEvent(new Event('oss:palette'))} aria-label="Search"><Search size={18} aria-hidden /></button>;
}
