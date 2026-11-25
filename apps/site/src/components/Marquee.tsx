/** A thin, endless line of words. Pauses on hover and stands still for people who prefer reduced motion. */
export function Marquee({ items }: { items: readonly string[] }) {
  const row = (hidden?: boolean) => (<ul aria-hidden={hidden || undefined}>{items.map(w => <li key={w}>{w}<i /></li>)}</ul>);
  return (<div className="marq" role="presentation"><div className="marq-t">{row()}{row(true)}{row(true)}</div></div>);
}
