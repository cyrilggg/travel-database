import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { guides, mapCities } from '../app/generated/publicGuides';

const root = new URL('../', import.meta.url);
for (const [code, prefix, total, researched] of [['KR', 'south-korea', 85, 85], ['KP', 'north-korea', 28, 14]] as const) {
  test(`${code}: inventory identities, coverage and published content agree`, async () => {
    const inventory = (await readFile(new URL(`data/${code.toLowerCase()}-city-centers.csv`, root), 'utf8')).trim().split(/\r?\n/).slice(1);
    assert.equal(inventory.length, total);
    const cities = mapCities.filter(city => city.countryCode === code);
    assert.equal(cities.length, total);
    assert.equal(cities.filter(city => city.coverage === 1).length, researched);
    assert.equal(guides.filter(guide => guide.countryCode === code).length, researched);
    for (const line of inventory) {
      const [id, name, , , geonamesId, longitude, latitude] = line.split(',');
      const city = cities.find(city => city.id === `${prefix}-${id}`);
      assert.ok(city, name);
      assert.equal(city.city, name);
      assert.deepEqual(city.coordinates, { longitude: Number(longitude), latitude: Number(latitude) });
      if (!city.coverage) {
        assert.equal(city.guideId, undefined);
        continue;
      }
      const guide = guides.find(guide => guide.id === city.guideId);
      assert.ok(guide, name);
      assert.equal(guide.id, `${code.toLowerCase()}-${geonamesId}`);
      assert.equal(guide.city, name);
      assert.equal(guide.countryCode, code);
      assert.deepEqual(guide.coordinates, city.coordinates);
      assert.equal(mapCities.filter(city => city.guideId === guide.id).length, 1);
      assert.ok(guide.fullTextPath);
      const markdown = await readFile(new URL(`public${guide.fullTextPath}`, root), 'utf8');
      await access(new URL(`pages-dist${guide.fullTextPath}`, root));
      assert.ok(guide.summary.length >= 120 && guide.summary.length <= 180, name);
      assert.doesNotMatch(guide.summary, /https?:|GitHub|建议停留|初访|预订|预约|[123一二三]天/);
      assert.equal(markdown.match(/^## /gm)?.length, 10);
      assert.match(markdown, /## 来源与更新记录/);
      const sections = JSON.parse(await readFile(new URL(`public${guide.structuredPath}`, root), 'utf8'));
      for (const key of ['overview', 'regions', 'attractions', 'food', 'itinerary', 'transport']) {
        assert.ok(sections.some((section: { key: string; items: unknown[] }) => section.key === key && section.items.length > 0), `${name}: ${key}`);
      }
      if (code === 'KP') {
        assert.match(markdown, /其他证件的开放日期待确认/);
        assert.match(JSON.stringify(sections.find((s: { key: string }) => s.key === 'overview')), /当前接待/);
        assert.match(guide.suggestedStay, /获批行程/);
      }
    }
  });
}
