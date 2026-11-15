import Link from 'next/link';
export default function NotFound() {
  return <section className="phd" style={{ minHeight: '60svh' }}><div className="wrap"><h1>That page is not here.</h1><p className="lede">It may have moved, or the link may be wrong.</p><div className="acts"><Link className="btn ink" href="/">Back to home</Link><Link className="btn line" href="/contact">Contact us</Link></div></div></section>;
}
