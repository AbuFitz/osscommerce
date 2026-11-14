export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return <div className="qa">{items.map(i => <details key={i.q}><summary>{i.q}</summary><p>{i.a}</p></details>)}</div>;
}
