export function Browser({ children, url, className = '' }: { children: React.ReactNode; url?: string; className?: string }) {
  return (<div className={`bw ${className}`}><div className="bw-bar" aria-hidden><i /><i /><i />{url && <span>{url}</span>}</div><div className="bw-scr">{children}</div></div>);
}
/** A phone drawn to real proportions. Sizes are container units, so it stays correct at any width. */
export function Phone({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (<div className={`phn ${className}`} style={style}><div className="phn-b"><span className="phn-k a" aria-hidden /><span className="phn-k b" aria-hidden /><span className="phn-k c" aria-hidden /><div className="phn-z"><div className="phn-s">{children}</div><span className="phn-i" aria-hidden /></div></div></div>);
}
