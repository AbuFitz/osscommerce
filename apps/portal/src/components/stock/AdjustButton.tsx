'use client';
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AdjustDialog } from './AdjustStock';
import type { StockRow } from '@/lib/gateway';
export function AdjustButton({ row }: { row: StockRow }) { const [o, setO] = useState(false); return (<><button type="button" className="btn primary" onClick={() => setO(true)}><SlidersHorizontal size={15} aria-hidden />Adjust stock</button><AdjustDialog row={row} open={o} onClose={() => setO(false)} /></>); }
