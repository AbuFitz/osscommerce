import Link from 'next/link';
export default function NotFound() {
  return (<main className="fh"><div className="wrap"><p className="tag">404</p><h1 className="d1" style={{ marginTop: 18 }}>Page not <span className="it" style={{ color: 'var(--green)' }}>found.</span></h1><div className="acts" style={{ marginTop: 32 }}><Link className="btn go" href="/">Back home</Link></div></div></main>);
}
