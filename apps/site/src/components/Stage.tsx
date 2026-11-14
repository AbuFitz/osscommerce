'use client';
import { useState } from 'react';
import { StorefrontPage, CONCEPTS, type Variant } from './StorefrontPage';
import { Display, IPhone } from './Devices';

const ORDER: Variant[] = ['ceramics', 'apothecary', 'coffee', 'audio', 'stationery'];
const BLURB: Record<Variant, string> = {
  ceramics: 'Warm, editorial, product-led.', apothecary: 'Calm and clear, built for repeat orders.', coffee: 'Dark, bold, subscription-first.', audio: 'Crisp and comparison-friendly.', stationery: 'Bright, tactile, gift-ready.',
};
/** Desktop: pick an industry, see the storefront and its phone view. Mobile: a swipe rail of phone views. Concept designs only. */
export function Stage() {
  const [i, setI] = useState(0); const v = ORDER[i];
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setI((i + 1) % 5); if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setI((i + 4) % 5); };
  return (
    <>
      <div className="stage-wrap">
        <div className="ind" role="tablist" aria-label="Storefront concepts by industry" onKeyDown={onKey}>
          {ORDER.map((k, n) => (
            <button key={k} role="tab" type="button" aria-selected={n === i} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}>
              <i>0{n + 1}</i><b>{CONCEPTS[k].industry}</b><span>{BLURB[k]}</span>
            </button>))}
        </div>
        <div className="stage" key={v}>
          <div className="glass tag fade"><b>Concept design</b>Imagery is a 3D render, not a real shop.</div>
          <div className="main fade"><Display label={`${CONCEPTS[v].industry} storefront on a laptop`}><StorefrontPage v={v} /></Display></div>
          <div className="phone fade"><IPhone label="The same storefront on a phone"><StorefrontPage v={v} mobile /></IPhone></div>
        </div>
      </div>
      <div className="rail-m" aria-label="Storefront concepts">
        {ORDER.map(k => (
          <div key={k}><div className="card"><IPhone label={`${CONCEPTS[k].industry} storefront on a phone`}><StorefrontPage v={k} mobile /></IPhone></div><b>{CONCEPTS[k].industry}</b><span>{BLURB[k]}</span></div>))}
      </div>
    </>
  );
}
