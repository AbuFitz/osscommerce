'use client';
import { useTransition } from 'react';
import { useToast } from '@oss-commerce/ui';
import { startPaymentSetup } from '@/app/actions';

/** Starts Stripe-hosted onboarding (the reliable path; embedded components replace it where available). Sensitive details are entered in Stripe, never in OSS. */
export function PaymentSetupActions({ label, secondary }: { label: string; secondary?: { href: string; label: string } }) {
  const toast = useToast(); const [pending, start] = useTransition();
  return (<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <button className="btn lime" type="button" disabled={pending} onClick={() => start(async () => { const r = await startPaymentSetup(); if (r.ok) window.location.href = r.url; else toast(r.message, 'info'); })}>{pending ? 'Opening Stripe…' : label}</button>
    {secondary && <a className="btn" href={secondary.href} target="_blank" rel="noreferrer">{secondary.label}</a>}
  </div>);
}
