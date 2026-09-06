import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import { guides, mapCities } from '../app/generated/publicGuides';

const root = new URL('../', import.meta.url);
const samples = [
  ['cn-1668341', 'taiwan-63000', '台北市'],
  ['cn-1668355', 'taiwan-67000', '台南市'],
  ['cn-1673820', 'taiwan-64000', '高雄市'],
];

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

test('Taiwan batch does not expose other guides as full text', () => {
  assert.equal(guides.filter(guide => guide.fullTextPath).length, samples.length);
  assert.equal(mapCities.find(item => item.id === 'taiwan-65000')?.coverage, 0);
});
