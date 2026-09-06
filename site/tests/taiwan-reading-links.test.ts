import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGuideBrowse } from '../app/components/guideBrowse';
import { rewriteReadingLinks } from '../scripts/taiwan-reading';
const paths = new Map([
 ['destinations/中国/台湾省/台北市.md', 'cn-1668341'],
 ['destinations/中国/台湾省/README.md', 'taiwan-overview'],
 ['destinations/中国/台湾省/旅行区域/澎湖群岛/README.md', 'taiwan-region-澎湖群岛'],
]);
test('resolve source-relative cities, overview and regions in-app', () => {
 const result = rewriteReadingLinks('[台北](../../台北市.md) [总览](../../README.md) [澎湖](../澎湖群岛/README.md)', 'destinations/中国/台湾省/旅行区域/绿岛与兰屿/README.md', paths);
 assert.equal(result, `[台北](#reading=cn-1668341) [总览](#reading=taiwan-overview) [澎湖](#reading=${encodeURIComponent('taiwan-region-澎湖群岛')})`);
});
test('maintenance links become text, official sources and anchors remain links', () => {
 const result = rewriteReadingLinks('[记录](../../../coverage/readme.md) [交通](https://www.railway.gov.tw/) [本节](#行程)', 'destinations/中国/台湾省/README.md', paths);
 assert.equal(result, '记录 [交通](https://www.railway.gov.tw/) [本节](#行程)');
});
test('encoded filenames resolve; unpublished local images are not emitted', () => {
 const result = rewriteReadingLinks(`[城市](${encodeURIComponent('台北市.md')}) ![无图](local.jpg)`, 'destinations/中国/台湾省/README.md', paths);
 assert.equal(result, '[城市](#reading=cn-1668341) 无图');
});

test('Taiwan opt-in fallback preserves unfamiliar table headings without changing legacy extraction', () => {
 const markdown = '## 美食与餐饮\n\n| 当地味道 | 内容与场景 |\n|---|---|\n| 米食 | 市场早餐 |\n';
 assert.deepEqual(parseGuideBrowse(markdown), []);
 const sections = parseGuideBrowse(markdown, [], true);
 assert.equal(sections[0]?.key, 'food');
 assert.equal(sections[0]?.items[0]?.title, '米食');
 assert.deepEqual(sections[0]?.items[0]?.fields, [{ label: '内容与场景', value: '市场早餐' }]);
});
