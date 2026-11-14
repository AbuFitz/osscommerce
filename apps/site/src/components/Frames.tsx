export function BrowserFrame({ src, alt, w = 2160, h = 1350, url = 'dashboard.yourshop.co.uk', priority }: { src: string; alt: string; w?: number; h?: number; url?: string; priority?: boolean }) {
  return (
    <div className="bframe">
      <div className="bbar" aria-hidden><i /><i /><i /><span>{url}</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={w} height={h} loading={priority ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}
export function PhoneFrame({ src, alt, w = 1170, h = 2532, priority }: { src: string; alt: string; w?: number; h?: number; priority?: boolean }) {
  return (
    <div className="pframe">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={w} height={h} loading={priority ? 'eager' : 'lazy'} decoding="async" />
    </div>
  );
}
