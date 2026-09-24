import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { guides, mapCities } from '../app/generated/publicGuides';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('../coverage/ASIA/major-cities-2026-09-25/published-guides.json', root), 'utf8'));

for (const entry of manifest) {
  test(`${entry.city}: existing map identity opens full researched content`, async () => {
    const city = mapCities.find(city => city.id === entry.mapId);
    assert.equal(city?.guideId, entry.guideId);
    assert.equal(city?.coverage, 1);
    const guide = guides.find(guide => guide.id === entry.guideId);
    assert.ok(guide);
    assert.equal(guide.countryCode, entry.country);
    assert.equal(guide.geonamesId, entry.geonamesId);
    assert.deepEqual(guide.coordinates, city?.coordinates);
    assert.equal(mapCities.filter(city => city.guideId === guide.id).length, 1);
    assert.ok(guide.summary.length >= 120 && guide.summary.length <= 180);
    assert.doesNotMatch(guide.summary, /https?:|GitHub|建议停留|预约/);
    assert.ok(guide.fullTextPath);
    const markdown = await readFile(new URL(`pages-dist${guide.fullTextPath}`, root), 'utf8');
    assert.equal(markdown.match(/^## /gm)?.length, 10);
    assert.match(markdown, /## 来源与更新记录/);
    const sections = JSON.parse(await readFile(new URL(`pages-dist${guide.structuredPath}`, root), 'utf8'));
    for (const key of ['overview', 'regions', 'attractions', 'food', 'itinerary', 'transport']) {
      assert.ok(sections.some((section: {key: string; items: unknown[]}) => section.key === key && section.items.length > 0), key);
    }
  });
}

test('map-only cities retain their identity and empty-content experience', () => {
  const city = mapCities.find(city => city.id === 'thailand-NCM-CHAO-PHRAYA-SURASAK');
  assert.ok(city);
  assert.equal(city.coverage, 0);
  assert.equal(city.guideId, undefined);
  assert.ok(mapCities.some(city => city.countryCode === 'CN' && city.coverage === 1));
});
