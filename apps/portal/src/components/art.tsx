/** Renders an image only when the merchant has one. No placeholders: with no image the layout reflows around the text. */
export function Media({ src, alt, ratio = '4 / 3', size }: { src?: string; alt: string; ratio?: string; size?: number }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className="media" style={size ? { width: size, height: size, aspectRatio: '1' } : { aspectRatio: ratio }} />;
}
