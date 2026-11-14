/** Device frames drawn in CSS: crisp at any size, no image assets. Screens take any content. */
export function Display({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="dsp" role={label ? 'img' : undefined} aria-label={label}>
      <div className="dsp-body"><div className="dsp-bezel"><div className="dsp-screen">{children}</div></div></div>
      <div className="dsp-arm" aria-hidden /><div className="dsp-foot" aria-hidden />
    </div>
  );
}
export function IPhone({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="iph" role={label ? 'img' : undefined} aria-label={label}>
      <i className="iph-btn l1" aria-hidden /><i className="iph-btn l2" aria-hidden /><i className="iph-btn r1" aria-hidden />
      <div className="iph-in"><div className="iph-screen"><i className="iph-island" aria-hidden />{children}<i className="iph-home" aria-hidden /></div></div>
    </div>
  );
}
