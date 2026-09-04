import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guides, type GuideBrowseItem, type GuideBrowseSection } from "../app/generated/publicGuides";

type PlaceKind = "attraction" | "food-area";
type Priority = "A" | "B" | "C" | "route";

type MapPlace = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  kind: PlaceKind;
  itemTitles: string[];
  priority?: Priority;
  featured?: boolean;
  aliases?: string[];
};

type RouteStop = string | { placeId: string; label?: string };
type MapRoute = { id: string; title: string; itemTitle: string; stops: RouteStop[] };
type GuideOverride = { places?: MapPlace[]; routes?: MapRoute[] };
type OverrideFile = { version: number; guides: Record<string, GuideOverride> };

type Candidate = {
  key: string;
  guideId: string;
  city: string;
  adminArea: string;
  cityLongitude: number;
  cityLatitude: number;
  kind: PlaceKind;
  name: string;
  itemTitles: string[];
  priority?: Priority;
};

type CacheEntry = {
  name: string;
  longitude?: number;
  latitude?: number;
  status: "accepted" | "review" | "missing";
  source: "amap";
  formattedAddress?: string;
  level?: string;
  updatedAt: string;
};

type CacheFile = { version: number; entries: Record<string, CacheEntry> };

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overridesPath = path.join(siteRoot, "data", "guide-map-overrides.json");
const cachePath = path.join(siteRoot, "data", "guide-map-cache.json");
const outputPath = path.join(siteRoot, "app", "generated", "guideMaps.ts");

const args = process.argv.slice(2);
const resolveCoordinates = args.includes("--resolve");
const guideArgument = readArgument("--guide");
const limitArgument = Number(readArgument("--limit") ?? "0");
const resolutionLimit = Number.isFinite(limitArgument) && limitArgument > 0 ? limitArgument : Infinity;

function readArgument(name: string) {
  const equals = args.find((value) => value.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function stableId(guideId: string, kind: PlaceKind, name: string) {
  return `${kind === "attraction" ? "poi" : "food"}-${createHash("sha1")
    .update(`${guideId}:${kind}:${name}`)
    .digest("hex")
    .slice(0, 10)}`;
}

function candidateKey(guideId: string, kind: PlaceKind, name: string) {
  return `${guideId}::${kind}::${name.trim()}`;
}

function stripAdminSuffix(value: string) {
  return value.replace(/(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/u, "");
}

function normalizeName(value: string) {
  return value
    .replace(/[\s·•]/gu, "")
    .replace(/[—–－]/gu, "-")
    .replace(/(博物馆|博物院|纪念馆|风景名胜区|旅游景区|景区|繁育研究基地)$/u, "")
    .replace(/^(成都|北京|上海|天津|重庆)/u, "");
}

function priorityFrom(item: GuideBrowseItem): Priority | undefined {
  const badge = item.badges.find((value) => /^(A|B|C)$/u.test(value));
  if (badge === "A" || badge === "B" || badge === "C") return badge;
  if (item.badges.some((value) => value.includes("路线节点"))) return "route";
  return undefined;
}

const genericFoodArea = /^(全城|各商圈|居民街区|社区|社区餐馆|社区面馆|社区熟食店|川菜馆|卤味店|老城小吃店|固定店面|旅游街区|景区摊位)$/u;

function extractFoodAreas(item: GuideBrowseItem) {
  const areas = item.badges
    .flatMap((badge) => badge.split(/[、，,；;]|(?:及|和|与)(?=[^等])/u))
    .map((area) => area.trim())
    .map((area) => area.replace(/^(位于|主要在)/u, ""))
    .map((area) => area.replace(/(周边|附近|方向|一带|片区|街区|及全城.*|及各商圈.*)$/u, ""))
    .filter((area) => area.length >= 2 && area.length <= 18)
    .filter((area) => !genericFoodArea.test(area) && !/全城|各商圈|居民|社区|正式餐饮/u.test(area));
  return [...new Set(areas)].slice(0, 4);
}

function extractCandidates(
  guide: (typeof guides)[number],
  sections: GuideBrowseSection[],
  overriddenPlaces: MapPlace[],
) {
  const candidates: Candidate[] = [];
  const attractions = sections.find((section) => section.key === "attractions")?.items ?? [];
  const foods = sections.find((section) => section.key === "food")?.items ?? [];
  const overriddenTitles = new Set(overriddenPlaces.flatMap((place) => place.itemTitles));

  for (const item of attractions) {
    if (overriddenTitles.has(item.title)) continue;
    candidates.push({
      key: candidateKey(guide.id, "attraction", item.title),
      guideId: guide.id,
      city: guide.city,
      adminArea: guide.adminArea,
      cityLongitude: guide.coordinates.longitude,
      cityLatitude: guide.coordinates.latitude,
      kind: "attraction",
      name: item.title,
      itemTitles: [item.title],
      priority: priorityFrom(item),
    });
  }

  const foodAreas = new Map<string, Set<string>>();
  for (const item of foods) {
    if (overriddenTitles.has(item.title)) continue;
    for (const area of extractFoodAreas(item)) {
      const titles = foodAreas.get(area) ?? new Set<string>();
      titles.add(item.title);
      foodAreas.set(area, titles);
    }
  }
  for (const [name, itemTitles] of foodAreas) {
    candidates.push({
      key: candidateKey(guide.id, "food-area", name),
      guideId: guide.id,
      city: guide.city,
      adminArea: guide.adminArea,
      cityLongitude: guide.coordinates.longitude,
      cityLatitude: guide.coordinates.latitude,
      kind: "food-area",
      name,
      itemTitles: [...itemTitles],
    });
  }
  return candidates;
}

function placeAliases(place: MapPlace) {
  const values = [place.name, ...place.itemTitles, ...(place.aliases ?? [])];
  const aliases = new Set<string>();
  for (const value of values) {
    aliases.add(value);
    const normalized = normalizeName(value);
    if (normalized.length >= 2) aliases.add(normalized);
    for (const part of value.split(/[—–－-]/u)) {
      if (part.trim().length >= 2) aliases.add(part.trim());
    }
  }
  return [...aliases].sort((a, b) => b.length - a.length);
}

function deriveRoutes(items: GuideBrowseItem[], places: MapPlace[], overridden: MapRoute[]) {
  const overriddenTitles = new Set(overridden.map((route) => route.itemTitle));
  const routes = [...overridden];
  for (const item of items) {
    if (overriddenTitles.has(item.title)) continue;
    const routeText = [item.description, ...item.fields.map((field) => field.value)].filter(Boolean).join(" ");
    const matches = places
      .filter((place) => place.kind === "attraction")
      .map((place) => {
        const positions = placeAliases(place)
          .map((alias) => routeText.indexOf(alias))
          .filter((position) => position >= 0);
        return { place, position: positions.length ? Math.min(...positions) : -1 };
      })
      .filter((match) => match.position >= 0)
      .sort((a, b) => a.position - b.position);
    const unique = [...new Map(matches.map((match) => [match.place.id, match])).values()];
    if (unique.length < 2) continue;
    routes.push({
      id: `route-${createHash("sha1").update(`${item.id}:${item.title}`).digest("hex").slice(0, 10)}`,
      title: item.title,
      itemTitle: item.title,
      stops: unique.map(({ place }) => place.id),
    });
  }
  return routes;
}

function mapPlaceFromCandidate(candidate: Candidate, entry?: CacheEntry): MapPlace | undefined {
  if (!entry || entry.status !== "accepted" || entry.longitude === undefined || entry.latitude === undefined) return;
  return {
    id: stableId(candidate.guideId, candidate.kind, candidate.name),
    name: candidate.name,
    longitude: entry.longitude,
    latitude: entry.latitude,
    kind: candidate.kind,
    itemTitles: candidate.itemTitles,
    priority: candidate.priority,
    featured: candidate.kind === "attraction" && (candidate.priority === "A" || candidate.priority === "route"),
  };
}

function publicPlace(place: MapPlace) {
  const result = { ...place };
  delete result.aliases;
  return result;
}

function gcj02ToWgs84(longitude: number, latitude: number) {
  const pi = Math.PI;
  const a = 6378245;
  const ee = 0.006693421622965943;
  const transformLatitude = (x: number, y: number) => {
    let result = -100 + 2 * x + 3 * y + 0.2 * y ** 2 + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    result += ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
    result += ((20 * Math.sin(y * pi) + 40 * Math.sin((y / 3) * pi)) * 2) / 3;
    result += ((160 * Math.sin((y / 12) * pi) + 320 * Math.sin((y * pi) / 30)) * 2) / 3;
    return result;
  };
  const transformLongitude = (x: number, y: number) => {
    let result = 300 + x + 2 * y + 0.1 * x ** 2 + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    result += ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
    result += ((20 * Math.sin(x * pi) + 40 * Math.sin((x / 3) * pi)) * 2) / 3;
    result += ((150 * Math.sin((x / 12) * pi) + 300 * Math.sin((x / 30) * pi)) * 2) / 3;
    return result;
  };
  const radLatitude = (latitude / 180) * pi;
  let magic = Math.sin(radLatitude);
  magic = 1 - ee * magic ** 2;
  const sqrtMagic = Math.sqrt(magic);
  const deltaLatitude =
    (transformLatitude(longitude - 105, latitude - 35) * 180) /
    (((a * (1 - ee)) / (magic * sqrtMagic)) * pi);
  const deltaLongitude =
    (transformLongitude(longitude - 105, latitude - 35) * 180) /
    ((a / sqrtMagic) * Math.cos(radLatitude) * pi);
  return { longitude: longitude - deltaLongitude, latitude: latitude - deltaLatitude };
}

async function resolveWithAmap(candidates: Candidate[], cache: CacheFile) {
  const key = process.env.AMAP_WEB_SERVICE_KEY;
  if (!key) throw new Error("批量解析坐标需要设置 AMAP_WEB_SERVICE_KEY；普通构建会直接使用本地缓存。");
  let resolved = 0;
  const pending = candidates.filter((candidate) => !cache.entries[candidate.key]).slice(0, resolutionLimit);
  const byGuide = new Map<string, Candidate[]>();
  for (const candidate of pending) {
    const group = byGuide.get(candidate.guideId) ?? [];
    group.push(candidate);
    byGuide.set(candidate.guideId, group);
  }

  let processed = 0;
  for (const group of byGuide.values()) {
    for (let offset = 0; offset < group.length; offset += 10) {
      const batch = group.slice(offset, offset + 10);
      const first = batch[0];
      const url = new URL("https://restapi.amap.com/v3/geocode/geo");
      url.searchParams.set("key", key);
      url.searchParams.set("address", batch.map((candidate) => candidate.name).join("|"));
      url.searchParams.set("city", stripAdminSuffix(first.city));
      url.searchParams.set("batch", "true");
      const response = await fetch(url, { headers: { "User-Agent": "travel-database-guide-map-generator/1.0" } });
      if (!response.ok) throw new Error(`高德地理编码请求失败：HTTP ${response.status}`);
      const payload = (await response.json()) as {
        status: string;
        info?: string;
        geocodes?: Array<{ formatted_address?: string; province?: string; level?: string; location?: string }>;
      };
      if (payload.status !== "1") throw new Error(`高德地理编码请求失败：${payload.info ?? "未知错误"}`);
      const geocodes = payload.geocodes ?? [];

      batch.forEach((candidate, index) => {
        const result = geocodes[index];
        const [gcjLongitude, gcjLatitude] = (result?.location ?? "").split(",").map(Number);
        const provinceMatches = String(result?.province ?? "").includes(stripAdminSuffix(candidate.adminArea));
        if (!Number.isFinite(gcjLongitude) || !Number.isFinite(gcjLatitude)) {
          cache.entries[candidate.key] = {
            name: candidate.name,
            status: "missing",
            source: "amap",
            updatedAt: new Date().toISOString(),
          };
          return;
        }
        const coordinate = gcj02ToWgs84(gcjLongitude, gcjLatitude);
        const distance = Math.hypot(
          coordinate.longitude - candidate.cityLongitude,
          coordinate.latitude - candidate.cityLatitude,
        );
        cache.entries[candidate.key] = {
          name: candidate.name,
          ...coordinate,
          status: provinceMatches && distance <= 5 ? "accepted" : "review",
          source: "amap",
          formattedAddress: result?.formatted_address,
          level: result?.level,
          updatedAt: new Date().toISOString(),
        };
        resolved += 1;
      });
      processed += batch.length;
      process.stdout.write(`\r已解析 ${processed}/${pending.length}`);
    }
  }
  if (pending.length) process.stdout.write("\n");
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return resolved;
}

const overrides = JSON.parse(await readFile(overridesPath, "utf8")) as OverrideFile;
const cache = JSON.parse(await readFile(cachePath, "utf8")) as CacheFile;
if (guideArgument && !guides.some((guide) => guide.id === guideArgument)) throw new Error(`未找到攻略：${guideArgument}`);

const records = await Promise.all(
  guides.map(async (guide) => {
    const sections = JSON.parse(
      await readFile(path.join(siteRoot, "public", guide.structuredPath.replace(/^\/+/, "")), "utf8"),
    ) as GuideBrowseSection[];
    const override = overrides.guides[guide.id] ?? {};
    const candidates = extractCandidates(guide, sections, override.places ?? []);
    return { guide, sections, override, candidates };
  }),
);
const allCandidates = records.flatMap((record) => record.candidates);
const resolutionCandidates = guideArgument
  ? allCandidates.filter((candidate) => candidate.guideId === guideArgument)
  : allCandidates;
const newlyResolved = resolveCoordinates ? await resolveWithAmap(resolutionCandidates, cache) : 0;

const guideMaps = records.flatMap(({ guide, sections, override, candidates }) => {
  const places = [
    ...(override.places ?? []),
    ...candidates.flatMap((candidate) => {
      const place = mapPlaceFromCandidate(candidate, cache.entries[candidate.key]);
      return place ? [place] : [];
    }),
  ];
  const itineraries = sections.find((section) => section.key === "itinerary")?.items ?? [];
  const routes = deriveRoutes(itineraries, places, override.routes ?? []);
  if (places.length === 0) return [];
  return [{
    guideId: guide.id,
    places: places.map(publicPlace),
    routes: routes.map((route) => ({
      ...route,
      stops: route.stops.map((stop) => typeof stop === "string" ? { placeId: stop } : stop),
    })),
  }];
});

const serialized = JSON.stringify(guideMaps, null, 2)
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");
const source = `// 由 scripts/generate-guide-maps.ts 批量生成，请修改 data/ 下的缓存或例外数据。\n\nimport type { GuideMapContent } from "../components/guideMapData";\n\nexport const guideMapsData = ${serialized} satisfies GuideMapContent[];\n`;
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, source, "utf8");

const attractionCount = allCandidates.filter((candidate) => candidate.kind === "attraction").length;
const foodAreaCount = allCandidates.length - attractionCount;
const acceptedCount = Object.values(cache.entries).filter((entry) => entry.status === "accepted").length;
const reviewCount = Object.values(cache.entries).filter((entry) => entry.status === "review").length;
console.log(
  `地图数据：扫描 ${records.length} 城，抽取 ${attractionCount} 个景点与 ${foodAreaCount} 个美食片区候选；` +
    `生成 ${guideMaps.length} 城，本地坐标 ${acceptedCount} 条，待复核 ${reviewCount} 条` +
    (newlyResolved ? `，本次解析 ${newlyResolved} 条` : ""),
);
