import 'server-only';
import { redirect } from 'next/navigation';
import { gateway } from './gateway-instance';
import { canSee } from './access';
/** A page a role is never shown also refuses a typed or bookmarked address, by sending them somewhere they can be. The engine refuses the data regardless. */
export async function gate(href: string) { const me = await gateway().viewer(); if (!canSee(me.kind, href)) redirect(href.startsWith('/settings') || href.startsWith('/account') ? '/settings' : '/'); }
