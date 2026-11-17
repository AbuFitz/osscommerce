/** onesimplecommerce. with the letters of "simple" lifting in turn on hover. */
export function Wordmark() {
  return (<span className="wm" aria-label="OneSimpleCommerce"><span aria-hidden>one</span><b aria-hidden>{'simple'.split('').map((c, i) => <i key={i} style={{ ['--i' as string]: i }}>{c}</i>)}</b><span aria-hidden>commerce</span><em aria-hidden>.</em></span>);
}
