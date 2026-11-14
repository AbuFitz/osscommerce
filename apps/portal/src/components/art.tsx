/** Abstract placeholder art: deliberately not a product, so nobody mistakes it for real merchandise. Swap for real photography. */
export function StillLife() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="a-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f1ede0" /><stop offset="1" stopColor="#dfe7c6" /></linearGradient>
        <linearGradient id="a-arch" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#5b7a28" /><stop offset="1" stopColor="#2a3a14" /></linearGradient>
        <linearGradient id="a-blue" x1="0" x2="1"><stop offset="0" stopColor="#dbe9f7" /><stop offset="1" stopColor="#a9c5e6" /></linearGradient>
        <radialGradient id="a-sun" cx=".2" cy=".05" r=".9"><stop offset="0" stopColor="#fff" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <pattern id="a-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="#14170f" opacity=".22" /></pattern>
      </defs>
      <rect width="400" height="300" fill="url(#a-bg)" />
      <path d="M70 300V150a80 80 0 0 1 160 0v150z" fill="url(#a-arch)" />
      <circle cx="292" cy="96" r="46" fill="#e4f55e" />
      <path d="M232 300v-70a70 70 0 0 1 140 0v70z" fill="url(#a-blue)" />
      <rect x="250" y="150" width="108" height="26" rx="13" fill="#e4dcfa" />
      <rect x="30" y="40" width="64" height="64" rx="32" fill="url(#a-dots)" />
      <rect width="400" height="300" fill="url(#a-sun)" />
    </svg>
  );
}

const PAIRS = [['#6f8a3a', '#2f3d1a'], ['#9db8e0', '#4b6a95'], ['#b9a5ec', '#6a4fb8'], ['#e6a877', '#a35a2c'], ['#8fb59a', '#3f6b52'], ['#d7b36a', '#8a6a1f']];
export function Tile({ seed, label, small }: { seed: string; label: string; small?: boolean }) {
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [a, b] = PAIRS[h % PAIRS.length];
  return <div className={`tile ${small ? 'sm' : ''}`} style={{ background: `radial-gradient(90% 70% at 20% 0%, rgba(255,255,255,.35), transparent 60%), linear-gradient(145deg, ${a}, ${b})` }} aria-hidden>{label.slice(0, 1)}</div>;
}
