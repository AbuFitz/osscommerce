'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/** Native <dialog>: focus trap, Esc, inert background and focus restore come from the platform. Bottom sheet on small screens. */
export function Dialog({ open, onClose, title, description, children, footer, actions }: {
  open: boolean; onClose: () => void; title: string; description?: string; children?: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="dlg-in">
        <div className="dlg-h">
          <div><h2 id={`${id}-t`}>{title}</h2>{description && <p id={`${id}-d`} className="muted">{description}</p>}</div>
          <div className="dlg-act">{actions}<button type="button" className="iconbtn sm" onClick={onClose} aria-label="Close"><X size={16} aria-hidden /></button></div>
        </div>
        <div className="dlg-b">{children}</div>
        {footer && <div className="dlg-f">{footer}</div>}
      </div>
    </dialog>
  );
}
