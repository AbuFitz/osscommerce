import Link from 'next/link';
export default function NotFound() {
  return <section className="dark" style={{ minHeight: '80svh' }}><div className="wrap ph"><h1>That page is not here.</h1><p className="lede sub">It may have moved. Try the home page.</p><div className="acts" style={{ marginTop: 32 }}><Link className="btn white" href="/">Back to home</Link></div></div></section>;
}
