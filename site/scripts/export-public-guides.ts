import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guides, mapCities } from "../app/generated/guides";
import { parseGuideBrowse } from "../app/components/guideBrowse";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(siteRoot, "app", "generated", "publicGuides.ts");
const structuredDirectory = path.join(siteRoot, "public", "structured");

await rm(structuredDirectory, { recursive: true, force: true });
await mkdir(structuredDirectory, { recursive: true });

const publicGuides = await Promise.all(
  guides.map(async (guide) => {
    const markdown = await readFile(
      path.join(siteRoot, "public", guide.markdownPath.replace(/^\/+/, "")),
      "utf8",
    );
    const browseSections = parseGuideBrowse(markdown, guide.sections);
    await writeFile(
      path.join(structuredDirectory, `${guide.id}.json`),
      JSON.stringify(browseSections),
      "utf8",
    );

    return {
      kind: guide.kind,
      id: guide.id,
      title: guide.title,
      city: guide.city,
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

// 原始 Markdown 只作为离线输入，绝不进入公开构建产物。
await rm(path.join(siteRoot, "public", "guides"), { recursive: true, force: true });

const provinceCount = new Set(publicGuides.map((guide) => guide.adminArea)).size;
const serialized = JSON.stringify(publicGuides, null, 2)
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");
const serializedMapCities = JSON.stringify(mapCities, null, 2)
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");

const moduleSource = `// 由私有攻略生成的公开结构化数据；不含原始 Markdown。

export type GuideBrowseKey = "overview" | "regions" | "attractions" | "food" | "itinerary" | "stay" | "transport" | "checklist";
export interface GuideCoordinates { longitude: number; latitude: number; }
export interface GuideBrowseLink { label: string; href: string; }
export interface GuideBrowseField { label: string; value: string; links?: GuideBrowseLink[]; }
export interface GuideBrowseItem { id: string; title: string; description?: string; badges: string[]; fields: GuideBrowseField[]; }
export interface GuideBrowseSection { key: GuideBrowseKey; label: string; hint: string; sourceTitle: string; items: GuideBrowseItem[]; totalCount: number; }
export interface TravelGuide {
  kind: "city"; id: string; title: string; city: string; adminArea: string; geonamesId: string;
  lastResearched: string; contentStatus: string; summary: string;
  suggestedStay: string; keywords: string[]; coordinates: GuideCoordinates; structuredPath: string;
}
export interface MapCity {
  id: string; administrativeCode: string; city: string; adminArea: string; cityLevel: string;
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
console.log(`已生成 ${publicGuides.length} 城公开结构化数据（不含原始 Markdown）`);
