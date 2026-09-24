import assert from 'node:assert/strict';
import test from 'node:test';
import rows from '../data/world-major-city-centers.json';
import sources from '../data/world-major-cities.sources.json';
import { mapCities } from '../app/generated/publicGuides';
import { validateWorldCityInventory, worldMapCities } from '../scripts/world-city-inventory.mjs';
import { visibleMapCities } from '../app/components/cityMapVisibility';
import { findMapCity } from '../app/components/citySearch';

test('global coverage includes every member/observer state and six inhabited continents', () => {
  const countries = new Set(mapCities.map(city => city.countryCode));
  assert.equal(new Set(sources.expectedCountryCodes).size, 195);
  assert.deepEqual(sources.expectedCountryCodes.filter(code => !countries.has(code)), []);
  assert.deepEqual([...new Set(mapCities.map(city => city.continentCode))].sort(), ['AF','AS','EU','NA','OC','SA']);
  const overviewCountries = new Set(visibleMapCities(mapCities, 0).map(city => city.countryCode));
  for (const code of sources.expectedCountryCodes) assert.ok(overviewCountries.has(code), code);
});

test('world additions use valid unique stable identities and honest empty-guide states', () => {
  validateWorldCityInventory(rows);
  const additions = mapCities.filter(city => city.id.startsWith('world-'));
  assert.equal(additions.length, rows.length);
  assert.equal(rows.length, 1106);
  assert.equal(new Set(rows.map(row => row.countryCode)).size, 162);
  assert.equal(mapCities.length - additions.length, 10647);
  assert.equal(new Set(mapCities.map(city => city.id)).size, mapCities.length);
  assert.ok(additions.every(city => city.coverage === 0 && !city.guideId));
  assert.ok(rows.every(row => !sources.existingCountryCodes.includes(row.countryCode)));
  assert.ok(rows.every(row => !/station|historic/i.test(row.sourceFeatureClass)));
  assert.ok(!rows.some(row => row.geonamesId === '694423'), 'Sevastopol keeps its existing Ukrainian inventory identity');
});

test('major-city threshold is explicit and small-state centers remain available', () => {
  for (const row of rows) {
    if (row.selection === 'large-urban-center') assert.ok((row.sourcePopulationEstimate ?? 0) >= 250000);
    else if (row.selection === 'regional-significance') {
      assert.ok((row.scaleRank ?? Infinity) <= 4);
      assert.ok((row.sourcePopulationEstimate ?? 0) >= 50000);
    } else assert.ok(['source-capital','regional-fallback','reviewed-addition','reviewed-administrative-center'].includes(row.selection));
  }
  for (const code of ['NR','VA','TV','LI','MC','SM','PW','FM','MH','KI']) {
    assert.ok(rows.some(row => row.countryCode === code), code);
  }
  assert.ok(rows.some(row => row.city === '基特加'));
});

test('representative world cities can be searched and have plausible coordinates', () => {
  for (const [name, country, west, east, south, north] of [
    ['巴黎','FR',2,3,48,49], ['纽约','US',-75,-73,40,42],
    ['里约热内卢','BR',-44,-42,-24,-22], ['开罗','EG',30,32,29,31],
    ['悉尼','AU',150,152,-35,-33], ['亚伦','NR',166,167,-1,0],
  ] as const) {
    const city = findMapCity(mapCities, name);
    assert.ok(city, name);
    assert.equal(city.countryCode, country);
    assert.ok(city.coordinates.longitude > west && city.coordinates.longitude < east);
    assert.ok(city.coordinates.latitude > south && city.coordinates.latitude < north);
  }
});

test('future researched guides attach to the existing world ID without duplicate entry', () => {
  const row = rows.find(row => row.city === '巴黎')!;
  const guide = { id:'future-paris-guide', countryCode:row.countryCode, geonamesId:row.geonamesId };
  const linked = new Set<string>();
  const [city] = worldMapCities([row], [guide], linked);
  assert.equal(city.id, row.id);
  assert.equal(city.coverage, 1);
  assert.equal(city.guideId, guide.id);
  assert.ok(linked.has(guide.id));
  assert.throws(() => worldMapCities([row], [{...guide, countryCode:'US'}], new Set()), /identity conflict/);
  assert.throws(() => validateWorldCityInventory([row, row]), /duplicate/);
  assert.throws(() => validateWorldCityInventory([{...row, coordinates:{longitude:181, latitude:0}}]), /Invalid/);
});
