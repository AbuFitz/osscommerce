import Link from 'next/link';
export default function NotFound() {
  return <section className="hero"><div className="wrap"><div className="hero-copy"><span className="eyebrow">404</span><h1 style={{ fontSize: 'clamp(42px,6.4vw,92px)' }}>That page is not here.</h1><p className="lede">It may have moved. Try the home page.</p><Link className="btn primary" href="/">Back to home</Link></div></div></section>;
}
