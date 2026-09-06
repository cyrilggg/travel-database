import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import { guides, mapCities, regionalReadings } from '../app/generated/publicGuides';

const root = new URL('../', import.meta.url);
const samples = mapCities.filter(city => city.id.startsWith('taiwan-')).map(city => [city.guideId ?? '', city.id, city.city]);

for (const [guideId, mapId, name] of samples) {
  test(`${name}: stable map entry opens researched guide and complete reading content`, async () => {
    const guide = guides.find(item => item.id === guideId);
    assert.ok(guide);
    assert.equal(guide.city, name);
    const map = mapCities.find(item => item.id === mapId);
    assert.equal(map?.guideId, guideId);
    assert.equal(map?.coverage, 1);
    assert.deepEqual(map?.coordinates, guide.coordinates);
    assert.equal(mapCities.filter(item => item.guideId === guideId).length, 1);
    assert.ok(guide.fullTextPath);
    const markdown = await readFile(new URL(`public${guide.fullTextPath}`, root), 'utf8');
    assert.match(markdown, /## 不同旅行者须知/);
    assert.match(markdown, /## 来源与更新记录/);
    assert.match(markdown, /2026-09-06/);
    const sections = JSON.parse(await readFile(new URL(`public${guide.structuredPath}`, root), 'utf8'));
    for (const key of ['overview', 'regions', 'attractions', 'food', 'itinerary', 'transport']) {
      assert.ok(sections.some((section: { key: string; items: unknown[] }) => section.key === key && section.items.length > 0), `${name} missing ${key}`);
    }
    await access(new URL(`pages-dist${guide.fullTextPath}`, root));
  });
}

test('Taiwan full text remains scoped to its 23 cities alongside explicit country batches', () => {
  assert.equal(guides.filter(guide => guide.countryCode === 'CN' && guide.fullTextPath).length, samples.length);
  assert.equal(samples.length, 23);
  assert.equal(guides.filter(guide => guide.countryCode === 'CN' && !samples.some(([id]) => id === guide.id) && guide.fullTextPath).length, 0);
});


test('Taiwan overview and eight regions are readable without fabricated map points', async () => {
  assert.equal(regionalReadings.length, 9);
  assert.deepEqual(new Set(regionalReadings.filter(reading => reading.id !== 'taiwan-overview').map(reading => reading.id)),
    new Set(['北部山海与客家乡镇', '彰化与云林乡镇', '日月潭与南投山地', '阿里山与嘉义海岸', '恒春半岛与屏东沿海', '花东纵谷与东海岸', '澎湖群岛', '绿岛与兰屿'].map(name => `taiwan-region-${name}`)));
  assert.ok(regionalReadings.some(reading => reading.id === 'taiwan-overview'));
  const readableIds = new Set([...regionalReadings.map(reading => reading.id), ...samples.map(([id]) => id)]);
  for (const reading of [...regionalReadings, ...guides.filter(guide => guide.countryCode === 'CN' && guide.fullTextPath)]) {
    const markdown = await readFile(new URL(`public${reading.fullTextPath}`, root), 'utf8');
    await access(new URL(`pages-dist${reading.fullTextPath}`, root));
    assert.ok(markdown.length > 500);
    assert.ok(!mapCities.some(city => city.guideId === reading.id) || reading.id.startsWith('cn-'));
    for (const match of markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
      const href = match[1];
      assert.match(href, /^(?:https?:|mailto:|#)/, `unpublished local link: ${href}`);
      if (href.startsWith('#reading=')) assert.ok(readableIds.has(decodeURIComponent(href.slice(9))), href);
    }
  }
});
