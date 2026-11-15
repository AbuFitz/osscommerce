import Link from 'next/link';
export default function NotFound() {
  return <section className="fh" style={{ minHeight: '70svh' }}><div className="wrap"><p className="kicker">404</p><h1>That page is not here.</h1><p className="lede">It may have moved, or the link may be wrong.</p><div className="acts"><Link className="btn bone" href="/">Back to home</Link><Link className="btn glass" href="/contact">Contact us</Link></div></div></section>;
}
