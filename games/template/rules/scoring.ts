export function score(values: Record<string, number>) {
  const maximum = Math.max(...Object.values(values));
  return Object.keys(values).filter((seat) => values[seat] === maximum);
}
