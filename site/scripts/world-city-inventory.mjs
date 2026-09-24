import { readFile } from 'node:fs/promises';

export async function readWorldCityInventory() {
  const rows = JSON.parse(await readFile(new URL('../data/world-major-city-centers.json', import.meta.url), 'utf8'));
  validateWorldCityInventory(rows);
  return rows;
}

export function validateWorldCityInventory(rows) {
  const ids = new Set();
  const geonames = new Set();
  for (const row of rows) {
    const { longitude, latitude } = row.coordinates ?? {};
    if (!/^world-(ne|geonames)-\d+$/.test(row.id) || ids.has(row.id)
      || !/^[A-Z]{2}$/.test(row.countryCode) || !/^(AF|AS|EU|NA|SA|OC)$/.test(row.continentCode)
      || !/[\u3400-\u9fff]/u.test(row.city) || /[A-Za-z]/u.test(row.city)
      || !row.countryName || !row.sourceId
      || !['world_major_city', 'world_regional_center'].includes(row.cityLevel)
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || !Number.isFinite(latitude) || Math.abs(latitude) > 90
      || (row.geonamesId && geonames.has(row.geonamesId))) {
      throw new Error(`Invalid or duplicate world city: ${row.id}`);
    }
    ids.add(row.id);
    if (row.geonamesId) geonames.add(row.geonamesId);
  }
}

export function worldMapCities(rows, guides, mappedGuideIds) {
  const guidesByGeonamesId = new Map(guides.map(guide => [guide.geonamesId, guide]));
  return rows.map(row => {
    const guide = row.geonamesId ? guidesByGeonamesId.get(row.geonamesId) : undefined;
    if (guide && (guide.countryCode !== row.countryCode || mappedGuideIds.has(guide.id))) {
      throw new Error(`World city guide identity conflict: ${row.id}`);
    }
    if (guide) mappedGuideIds.add(guide.id);
    return {
      id: row.id, administrativeCode: `${row.source}:${row.sourceId}`,
      city: row.city, adminArea: row.countryName, cityLevel: row.cityLevel,
      countryCode: row.countryCode, countryName: row.countryName, continentCode: row.continentCode,
      coverage: guide ? 1 : 0, ...(guide ? { guideId: guide.id } : {}),
      coordinates: row.coordinates,
    };
  });
}
