/** Original still-life for hero/tiles. Placeholder for real merchant photography; no third-party imagery. */
export function StillLife() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3e7d3" /><stop offset="1" stopColor="#e2cba8" /></linearGradient>
        <linearGradient id="mug" x1="0" x2="1"><stop offset="0" stopColor="#f6f1e7" /><stop offset=".6" stopColor="#e6dccb" /><stop offset="1" stopColor="#cbbca2" /></linearGradient>
        <linearGradient id="bowl" x1="0" x2="1"><stop offset="0" stopColor="#7d9a3f" /><stop offset="1" stopColor="#3f5220" /></linearGradient>
        <radialGradient id="sun" cx=".25" cy=".1" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)" />
      <rect y="214" width="400" height="86" fill="#c9a97a" opacity=".55" />
      <rect width="400" height="300" fill="url(#sun)" />
      <ellipse cx="150" cy="236" rx="78" ry="12" fill="#5b4527" opacity=".25" />
      <ellipse cx="290" cy="240" rx="70" ry="11" fill="#5b4527" opacity=".25" />
      <path d="M96 140h108v62a54 40 0 0 1-108 0z" fill="url(#mug)" />
      <path d="M204 156h18a22 22 0 0 1 0 44h-18" fill="none" stroke="#d8cdb8" strokeWidth="13" strokeLinecap="round" />
      <ellipse cx="150" cy="140" rx="54" ry="11" fill="#7b5c36" />
      {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={104 + ((i * 37) % 92)} cy={150 + ((i * 53) % 44)} r={1.4} fill="#8a6a45" opacity=".55" />)}
      <path d="M222 190h136a68 56 0 0 1-136 0z" fill="url(#bowl)" />
      <ellipse cx="290" cy="190" rx="68" ry="12" fill="#2c3a15" />
      <ellipse cx="290" cy="188" rx="60" ry="8" fill="#b9d072" opacity=".5" />
    </svg>
  );
}

const PAIRS = [['#6f8a3a', '#2f3d1a'], ['#9db8e0', '#4b6a95'], ['#b9a5ec', '#6a4fb8'], ['#e6a877', '#a35a2c'], ['#8fb59a', '#3f6b52'], ['#d7b36a', '#8a6a1f']];
export function Tile({ seed, label, small }: { seed: string; label: string; small?: boolean }) {
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [a, b] = PAIRS[h % PAIRS.length];
  return <div className={`tile ${small ? 'sm' : ''}`} style={{ background: `radial-gradient(90% 70% at 20% 0%, rgba(255,255,255,.35), transparent 60%), linear-gradient(145deg, ${a}, ${b})` }} aria-hidden>{label.slice(0, 1)}</div>;
}
