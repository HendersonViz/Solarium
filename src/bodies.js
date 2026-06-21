// Real sidereal periods (seconds) and axial tilts (radians).
// Radii and distances are log-compressed so all 8 planets + orbits
// are visible at the default camera distance. Relative ordering is preserved.
//
// `wikiTitle` is the exact English Wikipedia article title used with the
// REST summary endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/<title>

export const SUN = {
  name: 'Sun',
  radius: 6,
  color: 0xffcc33,
  spinPeriod: 2.2e6, // ~25.4 day equatorial rotation
  emissive: true,
  wikiTitle: 'Sun'
};

// period (s): Mercury 7.6e6, Venus 1.94e7, Earth 3.156e7, Mars 5.94e7,
// Jupiter 3.74e8, Saturn 9.30e8, Uranus 2.66e9, Neptune 5.2e9.
export const PLANETS = [
  { name: 'Mercury', radius: 0.5, distance:  10, period: 7.6e6,  spinPeriod: 5.07e6, color: 0x9c8a7a, tilt: 0.0000, phase: 0.0, wikiTitle: 'Mercury_(planet)' },
  { name: 'Venus',   radius: 0.9, distance:  14, period: 1.94e7, spinPeriod: 7.39e7, color: 0xd9b38c, tilt: 3.0962, phase: 1.1, wikiTitle: 'Venus' },
  { name: 'Earth',   radius: 1.0, distance:  19, period: 3.156e7, spinPeriod: 8.616e4, color: 0x3b7dd8, tilt: 0.4091, phase: 2.3, wikiTitle: 'Earth' },
  { name: 'Mars',    radius: 0.7, distance:  25, period: 5.94e7, spinPeriod: 8.866e4, color: 0xc1440e, tilt: 0.4396, phase: 3.7, wikiTitle: 'Mars' },
  { name: 'Jupiter', radius: 3.0, distance:  38, period: 3.74e8, spinPeriod: 3.574e4, color: 0xd8ca9d, tilt: 0.0546, phase: 0.6, wikiTitle: 'Jupiter' },
  { name: 'Saturn',  radius: 2.5, distance:  52, period: 9.30e8, spinPeriod: 3.836e4, color: 0xe3d9a6, tilt: 0.4665, phase: 4.2, hasRing: true, wikiTitle: 'Saturn' },
  { name: 'Uranus',  radius: 1.7, distance:  66, period: 2.66e9, spinPeriod: 6.206e4, color: 0x9fe7e0, tilt: 1.7064, phase: 5.0, wikiTitle: 'Uranus' },
  { name: 'Neptune', radius: 1.6, distance:  80, period: 5.20e9, spinPeriod: 5.715e4, color: 0x4166f5, tilt: 0.4943, phase: 1.8, wikiTitle: 'Neptune' }
];
