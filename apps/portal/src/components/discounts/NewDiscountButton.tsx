'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DiscountForm } from './DiscountForm';
export function NewDiscountButton({ today }: { today: string }) { const [open, setOpen] = useState(false); return (<><button type="button" className="btn primary" onClick={() => setOpen(true)}><Plus size={15} aria-hidden />Create discount</button><DiscountForm open={open} onClose={() => setOpen(false)} today={today} /></>); }
