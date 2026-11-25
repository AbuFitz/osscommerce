/** Where a latitude and longitude lands on the cobe globe for a given spin (phi) and tilt (theta). Measured against cobe's own render, not assumed. */
export const GLOBE_R = 0.846; // radius as a fraction of half the canvas
export function project(lat: number, lng: number, phi: number, theta: number, scale = 1) {
  const la = lat * Math.PI / 180, a = lng * Math.PI / 180 + Math.PI / 2 + phi;
  const X = Math.cos(la) * Math.sin(a), Y = Math.sin(la), Z = Math.cos(la) * Math.cos(a);
  const y = Y * Math.cos(theta) - Z * Math.sin(theta), z = Z * Math.cos(theta) + Y * Math.sin(theta);
  return { x: X * GLOBE_R * scale, y: -y * GLOBE_R * scale, z };
}
/** The spin that brings a longitude to the front. */
export const faceLng = (lng: number) => -(lng * Math.PI / 180 + Math.PI / 2);
