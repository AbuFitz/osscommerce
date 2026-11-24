import { Header } from '@/components/ui';
import { Preferences } from '@/components/Preferences';
import { gateway } from '@/lib/gateway-instance';
export const metadata = { title: 'Preferences' };
export default async function Prefs() {
  const preferences = await gateway().preferences();
  return (<><Header title="Preferences" back={{ href: '/settings', label: 'Settings' }} /><Preferences initial={preferences} /></>);
}
