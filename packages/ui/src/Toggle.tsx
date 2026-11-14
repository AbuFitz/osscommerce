'use client';
import { useId } from 'react';

/** Switch: a real button with role=switch, so it works with keyboard, touch and screen readers. */
export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="tgl-row">
      <div className="tgl-t"><label id={`${id}-l`} htmlFor={id}>{label}</label>{description && <div id={`${id}-d`} className="muted">{description}</div>}</div>
      <button id={id} type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled} className="tgl" onClick={() => onChange(!checked)}><span aria-hidden /></button>
    </div>
  );
}
