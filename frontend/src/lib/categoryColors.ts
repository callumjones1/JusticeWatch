import { interpolateSinebow } from 'd3';

// Assigns each category a colour from an evenly-spaced sweep of the sinebow
// so a given category name always maps to the same colour everywhere it
// appears (Geo Map, Timeline, Network Map), regardless of which subset of
// categories happens to be selected at the time.
export function buildCategoryColourScale(categories: string[]): Map<string, string> {
  const sorted = [...new Set(categories)].sort();
  const scale = new Map<string, string>();
  sorted.forEach((name, i) => {
    scale.set(name, interpolateSinebow(i / sorted.length));
  });
  return scale;
}
