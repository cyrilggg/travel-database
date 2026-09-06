import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guides, mapCities } from "../app/generated/guides";
import matter from "gray-matter";
import { loadTaiwanReadings, rewriteReadingLinks } from "./taiwan-reading";
import { parseGuideBrowse } from "../app/components/guideBrowse";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(siteRoot, "app", "generated", "publicGuides.ts");
const structuredDirectory = path.join(siteRoot, "public", "structured");

await rm(structuredDirectory, { recursive: true, force: true });
await mkdir(structuredDirectory, { recursive: true });

const fullTextGuideIds = new Set(mapCities.filter((city) => city.id.startsWith("taiwan-") || ["KR", "KP"].includes(city.countryCode)).flatMap((city) => city.guideId ? [city.guideId] : []));
const readings = await loadTaiwanReadings(path.resolve(siteRoot, ".."));
const readingTargets = new Map([
  ...guides.filter((guide) => fullTextGuideIds.has(guide.id)).map((guide) => [guide.sourcePath, guide.id] as const),
  ...readings.map((reading) => [reading.sourcePath, reading.id] as const),
]);
for (const reading of readings) {
  await writeFile(path.join(structuredDirectory, `${reading.id}.md`),
    rewriteReadingLinks(reading.markdown, reading.sourcePath, readingTargets), "utf8");
}
const publicReadings = readings.map(({ id, title, fullTextPath }) => ({ id, title, fullTextPath }));

const publicGuides = await Promise.all(
  guides.map(async (guide) => {
    const markdown = await readFile(
      path.join(siteRoot, "public", guide.markdownPath.replace(/^\/+/, "")),
      "utf8",
    );
    const browseSections = parseGuideBrowse(markdown, guide.sections, fullTextGuideIds.has(guide.id));
    await writeFile(
      path.join(structuredDirectory, `${guide.id}.json`),
      JSON.stringify(browseSections),
      "utf8",
    );

    const fullTextPath = fullTextGuideIds.has(guide.id)
      ? `/structured/${guide.id}.md`
      : undefined;
    if (fullTextPath) {
      const source = matter(await readFile(path.join(siteRoot, "..", guide.sourcePath), "utf8")).content;
      await writeFile(path.join(structuredDirectory, `${guide.id}.md`), rewriteReadingLinks(source, guide.sourcePath, readingTargets), "utf8");
    }
    return {
      ...(fullTextPath ? { fullTextPath } : {}),
      kind: guide.kind,
      id: guide.id,
      title: guide.title,
      city: guide.city,
      countryCode: guide.countryCode,
      countryName: guide.countryName,
      adminArea: guide.adminArea,
      geonamesId: guide.geonamesId,
      lastResearched: guide.lastResearched,
      contentStatus: guide.contentStatus,
      summary: guide.summary,
      suggestedStay: guide.suggestedStay,
      keywords: guide.keywords,
      coordinates: guide.coordinates,
      structuredPath: `/structured/${guide.id}.json`,
    };
  }),
);

// 清除中间输入；显式选择的原创攻略发布全文到 structured。
await rm(path.join(siteRoot, "public", "guides"), { recursive: true, force: true });

const provinceCount = new Set(publicGuides.map((guide) => guide.adminArea)).size;
const serialized = JSON.stringify(publicGuides, null, 2)
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");
const serializedMapCities = JSON.stringify(mapCities, null, 2)
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");

const moduleSource = `// 公开结构化数据；显式选择的原创攻略另有全文路径。

export interface RegionalReading { id: string; title: string; fullTextPath: string; }
export const regionalReadings: RegionalReading[] = ${JSON.stringify(publicReadings, null, 2)};

export type GuideBrowseKey = "overview" | "regions" | "attractions" | "food" | "itinerary" | "stay" | "transport" | "checklist";
export interface GuideCoordinates { longitude: number; latitude: number; }
export interface GuideBrowseLink { label: string; href: string; }
export interface GuideBrowseField { label: string; value: string; links?: GuideBrowseLink[]; }
export interface GuideBrowseItem { id: string; title: string; description?: string; badges: string[]; fields: GuideBrowseField[]; }
export interface GuideBrowseSection { key: GuideBrowseKey; label: string; hint: string; sourceTitle: string; items: GuideBrowseItem[]; totalCount: number; }
export interface TravelGuide {
  countryCode: string; countryName: string;
  kind: "city"; id: string; title: string; city: string; adminArea: string; geonamesId: string;
  lastResearched: string; contentStatus: string; summary: string;
  suggestedStay: string; keywords: string[]; coordinates: GuideCoordinates; structuredPath: string; fullTextPath?: string;
}
export interface MapCity {
  id: string; administrativeCode: string; city: string; adminArea: string; cityLevel: string;
  countryCode: string; countryName: string; continentCode: string;
  coverage: 0 | 1; guideId?: string; coordinates: GuideCoordinates;
}
export const guides: TravelGuide[] = ${serialized};
export const mapCities: MapCity[] = ${serializedMapCities};
export const cityGuides = guides;
export const allGuides = guides;
export const guideById: Record<string, TravelGuide> = Object.fromEntries(guides.map((guide) => [guide.id, guide]));
export const guideCount = guides.length;
export const provinceCount = ${provinceCount};
export const targetCityCount = mapCities.length;
export const coveredCityCount = mapCities.filter((city) => city.coverage === 1).length;
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, moduleSource, "utf8");
console.log(`已生成 ${publicGuides.length} 城公开结构化数据；另发布 ${publicGuides.filter((guide) => guide.fullTextPath).length} 篇完整攻略`);
