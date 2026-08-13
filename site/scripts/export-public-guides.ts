import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guides } from "../app/generated/guides";
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
      completeness: guide.completeness,
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

const moduleSource = `// 由私有攻略生成的公开结构化数据；不含原始 Markdown。\n\nexport type GuideCompleteness = "complete" | "partial";\nexport type GuideBrowseKey = "overview" | "regions" | "attractions" | "food" | "itinerary" | "stay" | "transport" | "checklist";\nexport interface GuideCoordinates { longitude: number; latitude: number; }\nexport interface GuideBrowseLink { label: string; href: string; }\nexport interface GuideBrowseField { label: string; value: string; links?: GuideBrowseLink[]; }\nexport interface GuideBrowseItem { id: string; title: string; description?: string; badges: string[]; fields: GuideBrowseField[]; }\nexport interface GuideBrowseSection { key: GuideBrowseKey; label: string; hint: string; sourceTitle: string; items: GuideBrowseItem[]; totalCount: number; }\nexport interface TravelGuide {\n  kind: "city"; id: string; title: string; city: string; adminArea: string; geonamesId: string;\n  lastResearched: string; contentStatus: string; completeness: GuideCompleteness; summary: string;\n  suggestedStay: string; keywords: string[]; coordinates: GuideCoordinates; structuredPath: string;\n}\nexport const guides: TravelGuide[] = ${serialized};\nexport const cityGuides = guides;\nexport const allGuides = guides;\nexport const guideById: Record<string, TravelGuide> = Object.fromEntries(guides.map((guide) => [guide.id, guide]));\nexport const guideCount = guides.length;\nexport const provinceCount = ${provinceCount};\n`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, moduleSource, "utf8");
console.log(`已生成 ${publicGuides.length} 城公开结构化数据（不含原始 Markdown）`);
