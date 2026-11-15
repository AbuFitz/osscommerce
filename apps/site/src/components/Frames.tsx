/** Device frames drawn in CSS. Screens inside are real captures of the OSS Commerce dashboard (demo data) or live HTML. */
export function Browser({ children, url, className = '' }: { children: React.ReactNode; url?: string; className?: string }) {
  return (<div className={`bw ${className}`}><div className="bw-bar" aria-hidden><i /><i /><i />{url && <span>{url}</span>}</div><div className="bw-scr">{children}</div></div>);
}
export function Phone({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (<div className={`ph ${className}`}><div className="ph-scr">{children}</div></div>);
}
/** A dashboard capture. 2880×1800 source, shown from the top. */
export function Shot({ name, alt, eager, mobile }: { name: string; alt: string; eager?: boolean; mobile?: boolean }) {
  return <img src={`/shots/${name}.jpg`} alt={alt} width={mobile ? 1170 : 2880} height={mobile ? 2532 : 1800} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}
