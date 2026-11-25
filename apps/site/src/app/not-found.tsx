import Link from 'next/link';
export default function NotFound() {
  return (<section className="ph"><div className="wrap"><p className="tag">404</p><h1 className="d1" style={{ fontSize: 'clamp(40px,6vw,76px)' }}>That page <span className="grad">is not here.</span></h1><p className="lede">It may have moved. Try the home page, or message us and we will point you the right way.</p><div className="acts"><Link className="btn pri" href="/">Back home</Link><Link className="btn" href="/contact">Contact us</Link></div></div></section>);
}
