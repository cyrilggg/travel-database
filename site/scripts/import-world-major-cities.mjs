import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Converter } from 'opencc-js';

// Reproducible preparation step. Normal builds consume the checked-in snapshot.
// Download the pinned files in world-major-cities.sources.json to this directory.
const cache = new URL('../outputs/world-import/', import.meta.url);
const data = new URL('../data/', import.meta.url);
const sources = JSON.parse(await readFile(new URL('world-major-cities.sources.json', data), 'utf8'));
const readSource = async name => {
  const bytes = await readFile(new URL(name, cache));
  if (createHash('sha256').update(bytes).digest('hex') !== sources.files[name].sha256) {
    throw new Error(`Source changed: ${name}; review provenance before updating the snapshot`);
  }
  return bytes.toString('utf8');
};
const features = JSON.parse(await readSource('ne_10m_populated_places.geojson')).features;
const countryInfo = (await readSource('countryInfo.txt')).split(/\r?\n/)
  .filter(line => line && !line.startsWith('#')).map(line => line.split('\t'));
const continents = new Map(countryInfo.map(row => [row[0], row[8]]));
const simplify = Converter({ from: 'tw', to: 'cn' });
const countryNames = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
const existing = new Set(sources.existingCountryCodes);
const normalizeCountry = p => p.ADM0_A3 === 'KOS' ? 'XK' : p.ADM0_A3 === 'SOL' ? 'SO'
  : ['TW', 'HK', 'MO'].includes(p.ISO_A2) ? 'CN' : p.ISO_A2;
const eligible = features.filter(feature => {
  const p = feature.properties;
  const code = normalizeCountry(p);
  return !existing.has(code) && !['AQ', 'GS'].includes(code) && continents.has(code)
    && !Object.hasOwn(sources.excludedNaturalEarthIds, String(p.NE_ID))
    && !/station|historic/i.test(p.FEATURECLA);
});
const selected = eligible.filter(({ properties: p }) => p.ADM0CAP === 1 || p.POP_MAX >= 250000
  || (p.SCALERANK <= 4 && p.POP_MAX >= 50000)
  || sources.extraNaturalEarthIds.includes(String(p.NE_ID)));
const selectedCodes = new Set(selected.map(f => normalizeCountry(f.properties)));
const fallbackIds = new Set();
for (const code of new Set(eligible.map(f => normalizeCountry(f.properties)))) {
  if (selectedCodes.has(code)) continue;
  const candidate = eligible.filter(f => normalizeCountry(f.properties) === code)
    .sort((a, b) => b.properties.POP_MAX - a.properties.POP_MAX || a.properties.SCALERANK - b.properties.SCALERANK)[0];
  selected.push(candidate);
  fallbackIds.add(candidate.properties.NE_ID);
}
const rows = selected.map(({ properties: p, geometry }) => {
  const countryCode = normalizeCountry(p);
  const city = sources.nameOverrides[String(p.NE_ID)] ?? simplify(p.NAME_ZH ?? '');
  if (!/[\u3400-\u9fff]/u.test(city) || /[A-Za-z]/u.test(city)) throw new Error(`Missing Chinese name: ${p.NAME}`);
  const fallback = fallbackIds.has(p.NE_ID);
  return {
    id: `world-ne-${p.NE_ID}`, sourceId: String(p.NE_ID), source: 'natural-earth',
    geonamesId: sources.geonamesIdOverrides?.[String(p.NE_ID)]?.geonamesId
      ?? (Number(p.GEONAMESID) > 0 ? String(p.GEONAMESID) : null),
    city, sourceName: p.NAME, countryCode, countryName: countryNames.of(countryCode),
    continentCode: continents.get(countryCode),
    cityLevel: fallback ? 'world_regional_center' : 'world_major_city',
    coordinates: { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] },
    sourceFeatureClass: p.FEATURECLA, scaleRank: p.SCALERANK, sourcePopulationEstimate: p.POP_MAX,
    selection: fallback ? 'regional-fallback' : p.ADM0CAP === 1 ? 'source-capital'
      : p.POP_MAX >= 250000 ? 'large-urban-center'
      : p.SCALERANK <= 4 && p.POP_MAX >= 50000 ? 'regional-significance' : 'reviewed-addition',
  };
});
rows.push(...sources.supplements);
rows.sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.id.localeCompare(b.id));
if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate world ID');
await writeFile(new URL('world-major-city-centers.json', data), JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({ addedCities: rows.length, addedCountriesAndRegions: new Set(rows.map(row => row.countryCode)).size }));
