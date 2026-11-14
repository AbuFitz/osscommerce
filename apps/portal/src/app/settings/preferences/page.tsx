import { Header } from '@/components/ui';
import { Preferences } from '@/components/Preferences';
export const metadata = { title: 'Preferences' };
export default function Prefs() {
  return (<><Header title="Preferences" eyebrow="Settings" /><Preferences /></>);
}
