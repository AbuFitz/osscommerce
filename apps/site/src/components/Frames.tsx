/** Device frames drawn in CSS. Screens inside are real captures of the OneSimpleCommerce dashboard (demo data) or live HTML. */
export function Browser({ children, url, className = '' }: { children: React.ReactNode; url?: string; className?: string }) {
  return (<div className={`bw ${className}`}><div className="bw-bar" aria-hidden><i /><i /><i />{url && <span>{url}</span>}</div><div className="bw-scr">{children}</div></div>);
}
/** A phone drawn to real proportions: metal band, black bezel, dynamic island and side buttons. Sizes are container units, so it stays correct at any width. */
export function Phone({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (<div className={`phn ${className}`}><div className="phn-body"><span className="phn-btn a" aria-hidden /><span className="phn-btn b" aria-hidden /><span className="phn-btn c" aria-hidden />
    <div className="phn-bezel"><div className="phn-scr">{children}</div><span className="phn-island" aria-hidden /></div></div></div>);
}
export function Shot({ name, alt, eager, mobile }: { name: string; alt: string; eager?: boolean; mobile?: boolean }) {
  return <img src={`/shots/${name}.jpg`} alt={alt} width={mobile ? 1170 : 2880} height={mobile ? 2532 : 1800} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}
