import { describe, expect, it } from 'vitest';
import {
  CITIES,
  EDGES,
  REGIONS,
  getCity,
  isConnectedRegions,
  shortestConnection,
} from './germany';

describe('corrected classic Germany network', () => {
  it('has the physical 42 cities, six seven-city regions and 83 unique undirected edges', () => {
    expect(CITIES).toHaveLength(42);
    expect(EDGES).toHaveLength(83);
    expect(new Set(CITIES.map((city) => city.id)).size).toBe(42);
    expect(
      new Set(EDGES.map((edge) => [edge.from, edge.to].sort().join(':'))).size,
    ).toBe(83);
    for (const region of REGIONS)
      expect(CITIES.filter((city) => city.region === region.id)).toHaveLength(
        7,
      );
    for (const edge of EDGES) {
      expect(getCity(edge.from)).toBeDefined();
      expect(getCity(edge.to)).toBeDefined();
      expect(edge.from).not.toBe(edge.to);
      expect(edge.cost).toBeGreaterThanOrEqual(0);
    }
    expect(CITIES.some((city) => city.nameDe === 'Torgelow')).toBe(true);
    expect(CITIES.some((city) => city.nameDe === 'Stralsund')).toBe(false);
  });
  it('uses the three zero-price links and corrected southwestern triangle', () => {
    expect(
      EDGES.filter((edge) => edge.cost === 0)
        .map((edge) => [edge.from, edge.to].sort().join(':'))
        .sort(),
    ).toEqual(['duisburg:essen', 'frankfurt-main:wiesbaden', 'halle:leipzig']);
    const all = REGIONS.map((region) => region.id);
    expect(shortestConnection(['saarbrucken'], 'stuttgart', all)?.cost).toBe(
      17,
    );
    expect(shortestConnection(['mannheim'], 'stuttgart', all)?.cost).toBe(6);
    expect(shortestConnection(['duisburg'], 'dortmund', all)?.cost).toBe(4);
  });
  it('keeps each playing zone connected and cannot shortcut through excluded regions', () => {
    expect(isConnectedRegions(['north', 'northeast', 'east'])).toBe(true);
    expect(isConnectedRegions(['north', 'south'])).toBe(false);
    expect(isConnectedRegions(['north', 'north'])).toBe(false);
    expect(isConnectedRegions(['other'])).toBe(false);
    expect(shortestConnection([], 'kiel', ['north'])).toEqual({
      cost: 0,
      path: ['kiel'],
    });
    expect(shortestConnection(['flensburg'], 'rostock', ['north'])).toBeNull();
    // Direct 20 remains legal; the shorter 18 via Frankfurt is outside this zone.
    expect(
      shortestConnection(['osnabruck'], 'kassel', ['northwest'])?.cost,
    ).toBe(20);
    expect(
      shortestConnection(['essen'], 'koln', ['northwest', 'southwest'])?.cost,
    ).toBe(6);
  });
  it('computes multi-source shortest paths while leaving intermediate cities buildable or occupied', () => {
    const all = REGIONS.map((region) => region.id);
    expect(
      shortestConnection(['flensburg', 'munchen'], 'passau', all)?.cost,
    ).toBe(14);
    const route = shortestConnection(['flensburg'], 'hamburg', all)!;
    expect(route).toEqual({ cost: 12, path: ['flensburg', 'kiel', 'hamburg'] });
    for (const city of CITIES)
      expect(shortestConnection(['flensburg'], city.id, all)).not.toBeNull();
  });
});
