'use server';
import { revalidatePath } from 'next/cache';
import { gateway } from '@/lib/gateway-instance';
import type { MutationResult, RefundInput, Member } from '@/lib/gateway';

/** Every mutation passes through here: one place to add session, membership, operation and audit checks. */
async function run(fn: () => Promise<MutationResult>, paths: string[]): Promise<MutationResult> {
  try { const r = await fn(); if (r.ok) paths.forEach(p => revalidatePath(p)); return r; }
  catch { return { ok: false, message: 'That did not go through. Nothing was changed. Try again, or contact support.' }; }
}
export async function fulfilOrder(id: string, tracking?: string) { return run(() => gateway().fulfilOrder(id, tracking), ['/orders', '/']); }
export async function refundOrder(i: RefundInput) { return run(() => gateway().refundOrder(i), ['/orders', '/']); }
export async function inviteMember(email: string, role: Member['role']) { return run(() => gateway().inviteMember(email, role), ['/settings/team']); }
export async function rollbackTheme(v: string) { return run(() => gateway().rollbackTheme(v), ['/storefront']); }
export async function decideGrant(id: string, d: 'approve' | 'decline' | 'revoke') { return run(() => gateway().decideGrant(id, d), ['/settings/team']); }
export async function savePreferences(p: Record<string, boolean>) { return run(() => gateway().savePreferences(p), ['/settings/preferences']); }
