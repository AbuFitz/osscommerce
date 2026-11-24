'use client';
import { useTransition } from 'react';
import { useToast } from '@oss-commerce/ui';
import { startBillingPortal } from '@/app/actions';

export function BillingPortalAction() {
  const toast = useToast(); const [pending, start] = useTransition();
  return <button className="btn lime" type="button" disabled={pending} onClick={() => start(async () => {
    const result = await startBillingPortal();
    if (result.ok) window.location.href = result.url; else toast(result.message, 'info');
  })}>{pending ? 'Opening Stripe…' : 'Manage billing'}</button>;
}
