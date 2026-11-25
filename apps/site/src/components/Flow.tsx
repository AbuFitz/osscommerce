/** A section with a slowly moving black-and-white gradient behind it. `dk` is black with silver sweeps; `lt` is white with soft graphite clouds; `sweep` slides a band across. */
export function Flow({ tone = 'dk', motion = 'drift', className = '', children, as: T = 'section' }: { tone?: 'dk' | 'lt'; motion?: 'drift' | 'sweep'; className?: string; children: React.ReactNode; as?: 'section' | 'div' | 'header' }) {
  return (<T className={`flow ${tone} ${motion} ${className}`}><span className="flow-bg" aria-hidden /><div className="flow-in">{children}</div></T>);
}
