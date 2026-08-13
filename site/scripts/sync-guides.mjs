import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const projectRoot = path.resolve(siteRoot, "..");
const generatedDirectory = path.join(siteRoot, "app", "generated");
const outputPath = path.join(generatedDirectory, "guides.ts");
const publicRoot = path.join(siteRoot, "public");
const publicGuidesPath = path.join(publicRoot, "guides");

const guidesRoot = "destinations/中国";
const coordinateInventoryPath =
  "coverage/geonames/2026-07-30/inventory/CN.csv";
const legalCityInventoryPath =
  "coverage/legal-cities/2025-12-31/inventory/CN-legal-cities.csv";
const legalCityDecisionsPath =
  "coverage/legal-cities/2025-12-31/decisions/CN.csv";
const legalCityCentersPath = path.join(
  siteRoot,
  "data",
  "cn-legal-city-centers.csv",
);

class SourceRefUnavailableError extends Error {}

async function git(args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

async function resolveSourceRevision() {
  try {
    return (await git(["rev-parse", "--verify", "HEAD^{commit}"])).trim();
  } catch (cause) {
    throw new SourceRefUnavailableError(
      "无法读取当前仓库版本；未改动现有生成结果",
      { cause },
    );
  }
}

async function listGuidePaths() {
  const localRoot = path.join(projectRoot, ...guidesRoot.split("/"));
  const entries = await readdir(localRoot, { recursive: true });

  return entries
    .map((entry) => String(entry).replaceAll(path.sep, "/"))
    .filter(
      (relativePath) =>
        relativePath.endsWith(".md") &&
        path.posix.basename(relativePath).toLocaleLowerCase() !== "readme.md",
    )
    .map((relativePath) => path.posix.join(guidesRoot, relativePath))
    .sort();
}

async function readSourceFile(sourcePath) {
  return readFile(path.join(projectRoot, ...sourcePath.split("/")), "utf8");
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const header = rows.shift()?.map((column) => column.replace(/^\uFEFF/, ""));
  if (!header) return [];

  return rows
    .filter((columns) => columns.some(Boolean))
    .map((columns) =>
      Object.fromEntries(
        header.map((column, index) => [column, columns[index] ?? ""]),
      ),
    );
}

async function loadCoordinates() {
  const csv = await readSourceFile(coordinateInventoryPath);
  const coordinates = new Map();

  for (const row of parseCsv(csv)) {
    if (!row.geonameid) continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    coordinates.set(String(row.geonameid), { longitude, latitude });
  }

  return coordinates;
}

async function loadLegalMapCities(guides) {
  const [inventoryCsv, decisionsCsv, centersCsv] = await Promise.all([
    readSourceFile(legalCityInventoryPath),
    readSourceFile(legalCityDecisionsPath),
    readFile(legalCityCentersPath, "utf8"),
  ]);
  const decisionsByCode = new Map(
    parseCsv(decisionsCsv).map((row) => [row.administrative_code, row]),
  );
  const centersByCode = new Map(
    parseCsv(centersCsv).map((row) => [row.administrative_code, row]),
  );
  const guidesBySourcePath = new Map(
    guides.map((guide) => [guide.sourcePath, guide]),
  );
  const mappedGuideIds = new Set();

  const legalCities = parseCsv(inventoryCsv).map((city) => {
    const decision = decisionsByCode.get(city.administrative_code);
    const guide = decision
      ? guidesBySourcePath.get(decision.page_path)
      : undefined;
    const center = centersByCode.get(city.administrative_code);
    if (!center) {
      throw new Error(`${city.name}（${city.administrative_code}）缺少地图中心点`);
    }
    if (decision && !guide) {
      throw new Error(`${city.name} 的覆盖账本指向不存在的单城市攻略：${decision.page_path}`);
    }
    if (guide) mappedGuideIds.add(guide.id);

    return {
      id: `legal-${city.administrative_code}`,
      administrativeCode: city.administrative_code,
      city: city.name,
      adminArea: city.province_name,
      cityLevel: city.city_level,
      coverage: guide ? 1 : 0,
      ...(guide ? { guideId: guide.id } : {}),
      coordinates: {
        longitude: Number(center.longitude),
        latitude: Number(center.latitude),
      },
    };
  });

  const additionalGuideDestinations = guides
    .filter((guide) => !mappedGuideIds.has(guide.id))
    .map((guide) => ({
      id: `guide-${guide.id}`,
      administrativeCode: `geonames:${guide.geonamesId}`,
      city: guide.city,
      adminArea: guide.adminArea,
      cityLevel: "guide_destination",
      coverage: 1,
      guideId: guide.id,
      coordinates: guide.coordinates,
    }));

  const mapCities = [...legalCities, ...additionalGuideDestinations];
  const visibleGuideIds = mapCities.flatMap((city) =>
    city.guideId ? [city.guideId] : [],
  );
  if (
    visibleGuideIds.length !== guides.length ||
    new Set(visibleGuideIds).size !== guides.length
  ) {
    throw new Error("地图入口没有逐一覆盖所有单目的地攻略");
  }

  return mapCities;
}

function displayNameForObsidianTarget(target) {
  const normalized = target.replaceAll("\\", "/");
  const [fileTarget, heading] = normalized.split("#", 2);
  if (heading) return heading.replace(/^\^/, "").trim();

  const filename = fileTarget.split("/").at(-1) ?? fileTarget;
  return filename.replace(/\.md$/i, "").trim();
}

function cleanObsidianLinks(markdown) {
  return markdown
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) =>
      (label ?? displayNameForObsidianTarget(target)).trim(),
    )
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) =>
      (label ?? displayNameForObsidianTarget(target)).trim(),
    );
}

function cleanMarkdownForWeb(markdown) {
  const withoutObsidianLinks = cleanObsidianLinks(markdown);
  const relativeTarget =
    "(?!\\s*(?:[a-z][a-z0-9+.-]*:|/|#))[^)]+";

  return withoutObsidianLinks
    .replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${relativeTarget}\\)`, "gi"),
      "$1",
    )
    .replace(
      new RegExp(`\\[([^\\]]+)\\]\\(${relativeTarget}\\)`, "gi"),
      "$1",
    );
}

function plainText(markdown) {
  return cleanObsidianLinks(markdown)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\\\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstProseParagraph(markdown) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (
      !trimmed ||
      /^(?:#{1,6}\s|>|```|~~~|\||[-*+]\s|\d+[.)]\s)/.test(trimmed)
    ) {
      continue;
    }

    return plainText(trimmed);
  }

  return "";
}

function extractCalloutField(markdown, fieldName) {
  const normalized = markdown
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/^>\s?/gm, "");
  const match = normalized.match(
    new RegExp(
      `^(?:[-*+]\\s+)?(?:\\*\\*|__)?${fieldName}(?:\\*\\*|__)?\\s*[：:]\\s*(.+)$`,
      "m",
    ),
  );
  return match ? plainText(match[1]) : "";
}

function extractSuggestedStay(markdown) {
  const calloutValue = extractCalloutField(markdown, "建议停留");
  if (calloutValue) return calloutValue;

  const tableRow = markdown.match(
    /^\|\s*(?:\*\*|__)?建议停留(?:\*\*|__)?\s*\|\s*([^|\n]+?)\s*\|\s*$/m,
  );
  return tableRow ? plainText(tableRow[1]) : "";
}

function extractKeywords(markdown) {
  const keywords = extractCalloutField(markdown, "旅行关键词");
  if (!keywords) return [];

  return keywords
    .split(/[、，,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}

function sectionId(title, counts) {
  const base =
    plainText(title)
      .normalize("NFKC")
      .toLocaleLowerCase("zh-CN")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-|-$/g, "") || "section";
  const count = (counts.get(base) ?? 0) + 1;
  counts.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function extractSectionMetadata(markdown) {
  const headingPattern = /^(#{2,3})[ \t]+(.+?)\s*$/gm;
  const counts = new Map();

  return [...markdown.matchAll(headingPattern)].map((heading) => {
    const title = plainText(heading[2].replace(/\s+#+\s*$/, ""));
    return {
      id: sectionId(title, counts),
      title,
      level: heading[1].length,
    };
  });
}

function serialize(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function assertRequiredFrontmatter(data, sourcePath) {
  const requiredFields = [
    "schema_version",
    "title",
    "country",
    "country_code",
    "admin_area",
    "city",
    "geonames_id",
    "wikidata_id",
    "last_researched",
    "content_status",
  ];
  const missingFields = requiredFields.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === "",
  );

  if (missingFields.length) {
    throw new Error(`${sourcePath} 缺少 frontmatter：${missingFields.join(", ")}`);
  }
}

async function loadCityGuides(coordinateByGeonamesId) {
  const sourcePaths = await listGuidePaths();
  const guides = [];
  const markdownFiles = new Map();
  const seenCities = new Set();
  const seenGeonamesIds = new Set();

  for (const sourcePath of sourcePaths) {
    const source = await readSourceFile(sourcePath);
    const parsed = matter(source);
    assertRequiredFrontmatter(parsed.data, sourcePath);

    const city = String(parsed.data.city).trim();
    const adminArea = String(parsed.data.admin_area).trim();
    const geonamesId = String(parsed.data.geonames_id).trim();
    const wikidataId = String(parsed.data.wikidata_id).trim();
    const coordinates = coordinateByGeonamesId.get(geonamesId);

    if (parsed.data.country !== "中国" || parsed.data.country_code !== "CN") {
      throw new Error(`${sourcePath} 不是中国 CN 城市指南`);
    }
    if (seenCities.has(city)) throw new Error(`城市名重复：${city}`);
    if (seenGeonamesIds.has(geonamesId)) {
      throw new Error(`GeoNames ID 重复：${geonamesId}`);
    }
    if (!coordinates) {
      throw new Error(`${sourcePath} 的 GeoNames ${geonamesId} 无坐标`);
    }

    seenCities.add(city);
    seenGeonamesIds.add(geonamesId);

    const id = `cn-${geonamesId}`;
    const markdownPath = `/guides/${id}.md`;
    const rawMarkdown = cleanMarkdownForWeb(parsed.content).trim();
    const contentStatus = String(parsed.data.content_status).trim();

    guides.push({
      kind: "city",
      id,
      title: String(parsed.data.title).trim(),
      city,
      adminArea,
      geonamesId,
      wikidataId,
      sourcePath,
      markdownPath,
      lastResearched: normalizeDate(parsed.data.last_researched),
      contentStatus,
      summary: firstProseParagraph(rawMarkdown),
      suggestedStay: extractSuggestedStay(rawMarkdown),
      keywords: extractKeywords(rawMarkdown),
      sections: extractSectionMetadata(rawMarkdown),
      coordinates,
    });
    markdownFiles.set(`${id}.md`, `${rawMarkdown}\n`);
  }

  return {
    guides: guides.sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath, "zh-CN"),
    ),
    markdownFiles,
  };
}

function buildGeneratedModule(guides, mapCities, sourceRevision) {
  const provinceCount = new Set(guides.map((guide) => guide.adminArea)).size;

  return `// 此文件由 scripts/sync-guides.mjs 自动生成，请勿手工修改。
// 城市正文位于 public/guides，页面应按 markdownPath 懒加载。

export interface GuideCoordinates {
  longitude: number;
  latitude: number;
}

export interface GuideSection {
  id: string;
  title: string;
  level: number;
}

export interface TravelGuide {
  kind: "city";
  id: string;
  title: string;
  city: string;
  adminArea: string;
  geonamesId: string;
  wikidataId: string;
  sourcePath: string;
  markdownPath: string;
  lastResearched: string;
  contentStatus: string;
  summary: string;
  suggestedStay: string;
  keywords: string[];
  sections: GuideSection[];
  coordinates: GuideCoordinates;
}

export interface MapCity {
  id: string;
  administrativeCode: string;
  city: string;
  adminArea: string;
  cityLevel: string;
  coverage: 0 | 1;
  guideId?: string;
  coordinates: GuideCoordinates;
}

export const sourceRevision = ${serialize(sourceRevision)};

export const guides: TravelGuide[] = ${serialize(guides)};

export const mapCities: MapCity[] = ${serialize(mapCities)};

export const cityGuides = guides;

export const allGuides: TravelGuide[] = guides;

export const guideById: Record<string, TravelGuide> =
  Object.fromEntries(allGuides.map((guide) => [guide.id, guide]));

export const guideCount = guides.length;
export const provinceCount = ${provinceCount};
export const targetCityCount = mapCities.length;
export const coveredCityCount = mapCities.filter((city) => city.coverage === 1).length;
`;
}

function assertGeneratedPath(targetPath) {
  const relative = path.relative(publicRoot, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`拒绝替换 public 之外的目录：${targetPath}`);
  }
}

async function publishMarkdown(markdownFiles) {
  assertGeneratedPath(publicGuidesPath);
  await mkdir(publicRoot, { recursive: true });

  const suffix = `${process.pid}-${Date.now()}`;
  const stagingPath = path.join(publicRoot, `.guides-staging-${suffix}`);
  const backupPath = path.join(publicRoot, `.guides-backup-${suffix}`);
  assertGeneratedPath(stagingPath);
  assertGeneratedPath(backupPath);

  await mkdir(stagingPath, { recursive: true });
  try {
    await Promise.all(
      [...markdownFiles].map(([filename, markdown]) =>
        writeFile(path.join(stagingPath, filename), markdown, "utf8"),
      ),
    );

    let previousGuidesMoved = false;
    try {
      await rename(publicGuidesPath, backupPath);
      previousGuidesMoved = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await rename(stagingPath, publicGuidesPath);
    } catch (error) {
      if (previousGuidesMoved) await rename(backupPath, publicGuidesPath);
      throw error;
    }

    if (previousGuidesMoved) await rm(backupPath, { recursive: true });
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

async function hasExistingGeneratedResult() {
  try {
    await access(outputPath);
    return true;
  } catch {
    return false;
  }
}

async function syncGuides() {
  let sourceRevision;
  try {
    sourceRevision = await resolveSourceRevision();
  } catch (error) {
    if (
      error instanceof SourceRefUnavailableError &&
      (await hasExistingGeneratedResult())
    ) {
      console.warn(error.message);
      return;
    }
    throw error;
  }

  const coordinateByGeonamesId = await loadCoordinates();
  const cityResult = await loadCityGuides(coordinateByGeonamesId);
  if (!cityResult.guides.length) {
    throw new Error("当前仓库中没有可生成的中国城市指南");
  }
  const incompleteGuides = cityResult.guides
    .filter((guide) => !guide.summary || !guide.suggestedStay)
    .map((guide) => {
      const missing = [
        !guide.summary && "摘要",
        !guide.suggestedStay && "建议停留",
      ].filter(Boolean);
      return `${guide.sourcePath}（${missing.join("、")}）`;
    });
  if (incompleteGuides.length) {
    throw new Error(
      `城市指南缺少侧栏必要信息，未覆盖现有结果：${incompleteGuides.join("；")}`,
    );
  }

  const mapCities = await loadLegalMapCities(cityResult.guides);
  const generatedModule = buildGeneratedModule(
    cityResult.guides,
    mapCities,
    sourceRevision,
  );

  await publishMarkdown(cityResult.markdownFiles);
  await mkdir(generatedDirectory, { recursive: true });
  await writeFile(outputPath, generatedModule, "utf8");

  const provinceCount = new Set(
    cityResult.guides.map((guide) => guide.adminArea),
  ).size;
  const coveredCount = mapCities.filter((city) => city.coverage === 1).length;
  const missingCount = mapCities.filter((city) => city.coverage === 0).length;
  console.log(
    `已从当前仓库@${sourceRevision.slice(0, 7)} 同步 ${cityResult.guides.length} 个单目的地攻略；地图显示 ${coveredCount} 个已有攻略点、${missingCount} 个尚未收录点（${provinceCount} 个省级地区）`,
  );
}

await syncGuides();
