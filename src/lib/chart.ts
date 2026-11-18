/** The chart colour for the i-th series, cycling through the theme's palette (tokens.css). */
export function chartColor(i: number): string {
  return `var(--color-chart-${(i % 7) + 1})`;
}
