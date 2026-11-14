/** onesimplesite wordmark as used on onesimplesite.co.uk: lowercase, "simple" in green. */
export function Wordmark({ commerce = true }: { commerce?: boolean }) {
  return (
    <span className="wm" aria-label="OneSimpleSite Commerce">
      <span aria-hidden>one<b>simple</b>site</span>
      {commerce && <span className="wm-c" aria-hidden>commerce</span>}
    </span>
  );
}
