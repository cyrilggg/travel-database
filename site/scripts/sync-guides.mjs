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
const cityNamesZhPath = path.join(siteRoot, "data", "city-names-zh.csv");
const additionalCityCenterSources = [
  {
    path: path.join(siteRoot, "data", "tw-city-centers.csv"),
    idPrefix: "taiwan",
    codePrefix: "tw",
    levelPrefix: "taiwan",
    countryCode: "CN",
    countryName: "中国",
    continentCode: "AS",
  },
  {
    path: path.join(siteRoot, "data", "kr-city-centers.csv"),
    idPrefix: "south-korea",
    codePrefix: "kr",
    levelPrefix: "south_korea",
    countryCode: "KR",
    countryName: "韩国",
    continentCode: "AS",
  },
  {
    path: path.join(siteRoot, "data", "kp-city-centers.csv"),
    idPrefix: "north-korea",
    codePrefix: "kp",
    levelPrefix: "north_korea",
    countryCode: "KP",
    countryName: "朝鲜",
    continentCode: "AS",
  },
  {
    path: path.join(siteRoot, "data", "jp-city-centers.csv"),
    idPrefix: "japan",
    codePrefix: "jp",
    levelPrefix: "japan",
    countryCode: "JP",
    countryName: "日本",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "mn-official-cities-2026-09-06.csv",
    ),
    idPrefix: "mongolia",
    codePrefix: "mn",
    levelPrefix: "mongolia",
    countryCode: "MN",
    countryName: "蒙古",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ph-official-cities-2026-06-30.csv",
    ),
    idPrefix: "philippines",
    codePrefix: "ph",
    levelPrefix: "philippines",
    countryCode: "PH",
    countryName: "菲律宾",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "id-official-cities-2025.csv",
    ),
    idPrefix: "indonesia",
    codePrefix: "id",
    levelPrefix: "indonesia",
    countryCode: "ID",
    countryName: "印度尼西亚",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "vn-central-cities-2025-07-01.csv",
    ),
    idPrefix: "vietnam",
    codePrefix: "vn",
    levelPrefix: "vietnam",
    countryCode: "VN",
    countryName: "越南",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "th-city-municipalities-2026-06-10.csv",
    ),
    idPrefix: "thailand",
    codePrefix: "th",
    levelPrefix: "thailand",
    countryCode: "TH",
    countryName: "泰国",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "my-city-local-authorities-2026-09-06.csv",
    ),
    idPrefix: "malaysia",
    codePrefix: "my",
    levelPrefix: "malaysia",
    countryCode: "MY",
    countryName: "马来西亚",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "sg-city-state-2026-09-06.csv",
    ),
    idPrefix: "singapore",
    codePrefix: "sg",
    levelPrefix: "singapore",
    countryCode: "SG",
    countryName: "新加坡",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "bn-municipal-areas-2026-09-06.csv",
    ),
    idPrefix: "brunei",
    codePrefix: "bn",
    levelPrefix: "brunei",
    countryCode: "BN",
    countryName: "文莱",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "kh-official-municipalities-2026-09-06.csv",
    ),
    idPrefix: "cambodia",
    codePrefix: "kh",
    levelPrefix: "cambodia",
    countryCode: "KH",
    countryName: "柬埔寨",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "la-official-cities-2026-09-06.csv",
    ),
    idPrefix: "laos",
    codePrefix: "la",
    levelPrefix: "laos",
    countryCode: "LA",
    countryName: "老挝",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "mm-city-development-areas-2026-09-06.csv",
    ),
    idPrefix: "myanmar",
    codePrefix: "mm",
    levelPrefix: "myanmar",
    countryCode: "MM",
    countryName: "缅甸",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "tl-capital-city-2026-09-06.csv",
    ),
    idPrefix: "timor-leste",
    codePrefix: "tl",
    levelPrefix: "timor_leste",
    countryCode: "TL",
    countryName: "东帝汶",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "mv-city-councils-2026-09-06.csv",
    ),
    idPrefix: "maldives",
    codePrefix: "mv",
    levelPrefix: "maldives",
    countryCode: "MV",
    countryName: "马尔代夫",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "bt-autonomous-thromdes-2026-09-06.csv",
    ),
    idPrefix: "bhutan",
    codePrefix: "bt",
    levelPrefix: "bhutan",
    countryCode: "BT",
    countryName: "不丹",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "lk-municipal-councils-2026-09-06.csv",
    ),
    idPrefix: "sri-lanka",
    codePrefix: "lk",
    levelPrefix: "sri_lanka",
    countryCode: "LK",
    countryName: "斯里兰卡",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "np-urban-municipalities-2026-09-06.csv",
    ),
    idPrefix: "nepal",
    codePrefix: "np",
    levelPrefix: "nepal",
    countryCode: "NP",
    countryName: "尼泊尔",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "bd-urban-local-bodies-2026-09-06.csv",
    ),
    idPrefix: "bangladesh",
    codePrefix: "bd",
    levelPrefix: "bangladesh",
    countryCode: "BD",
    countryName: "孟加拉国",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "af-provincial-municipalities-2026-09-06.csv",
    ),
    idPrefix: "afghanistan",
    codePrefix: "af",
    levelPrefix: "afghanistan",
    countryCode: "AF",
    countryName: "阿富汗",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "pk-municipal-cities-2023.csv",
    ),
    idPrefix: "pakistan",
    codePrefix: "pk",
    levelPrefix: "pakistan",
    countryCode: "PK",
    countryName: "巴基斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "in-municipal-cities-2026-09-05.csv",
    ),
    idPrefix: "india",
    codePrefix: "in",
    levelPrefix: "india",
    countryCode: "IN",
    countryName: "印度",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "kz-kato-cities-2026-07-17.csv",
    ),
    idPrefix: "kazakhstan",
    codePrefix: "kz",
    levelPrefix: "kazakhstan",
    countryCode: "KZ",
    countryName: "哈萨克斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "kg-soate-cities-2025-10.csv",
    ),
    idPrefix: "kyrgyzstan",
    codePrefix: "kg",
    levelPrefix: "kyrgyzstan",
    countryCode: "KG",
    countryName: "吉尔吉斯斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "tj-statutory-cities-2025.csv",
    ),
    idPrefix: "tajikistan",
    codePrefix: "tj",
    levelPrefix: "tajikistan",
    countryCode: "TJ",
    countryName: "塔吉克斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "uz-soato-cities-2026-06-12.csv",
    ),
    idPrefix: "uzbekistan",
    codePrefix: "uz",
    levelPrefix: "uzbekistan",
    countryCode: "UZ",
    countryName: "乌兹别克斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "tm-statutory-cities-2026-09-06.csv",
    ),
    idPrefix: "turkmenistan",
    codePrefix: "tm",
    levelPrefix: "turkmenistan",
    countryCode: "TM",
    countryName: "土库曼斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "am-statutory-cities-2026-09-06.csv",
    ),
    idPrefix: "armenia",
    codePrefix: "am",
    levelPrefix: "armenia",
    countryCode: "AM",
    countryName: "亚美尼亚",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "az-statutory-cities-2026-09-06.csv",
    ),
    idPrefix: "azerbaijan",
    codePrefix: "az",
    levelPrefix: "azerbaijan",
    countryCode: "AZ",
    countryName: "阿塞拜疆",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ge-statutory-cities-2026-09-06.csv",
    ),
    idPrefix: "georgia",
    codePrefix: "ge",
    levelPrefix: "georgia",
    countryCode: "GE",
    countryName: "格鲁吉亚",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ir-county-seats-1404.csv",
    ),
    idPrefix: "iran",
    codePrefix: "ir",
    levelPrefix: "iran",
    countryCode: "IR",
    countryName: "伊朗",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "iq-city-centers-2026-09-06.csv",
    ),
    idPrefix: "iraq",
    codePrefix: "iq",
    levelPrefix: "iraq",
    countryCode: "IQ",
    countryName: "伊拉克",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "sy-city-centers-2026-09-06.csv",
    ),
    idPrefix: "syria",
    codePrefix: "sy",
    levelPrefix: "syria",
    countryCode: "SY",
    countryName: "叙利亚",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "lb-city-centers-2026-09-06.csv",
    ),
    idPrefix: "lebanon",
    codePrefix: "lb",
    levelPrefix: "lebanon",
    countryCode: "LB",
    countryName: "黎巴嫩",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "jo-city-centers-2026-09-06.csv",
    ),
    idPrefix: "jordan",
    codePrefix: "jo",
    levelPrefix: "jordan",
    countryCode: "JO",
    countryName: "约旦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "il-city-centers-2026-09-06.csv",
    ),
    idPrefix: "israel",
    codePrefix: "il",
    levelPrefix: "israel",
    countryCode: "IL",
    countryName: "以色列",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ps-city-centers-2026-09-06.csv",
    ),
    idPrefix: "palestine",
    codePrefix: "ps",
    levelPrefix: "palestine",
    countryCode: "PS",
    countryName: "巴勒斯坦",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "kw-city-centers-2026-09-06.csv",
    ),
    idPrefix: "kuwait",
    codePrefix: "kw",
    levelPrefix: "kuwait",
    countryCode: "KW",
    countryName: "科威特",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "bh-city-centers-2026-09-06.csv",
    ),
    idPrefix: "bahrain",
    codePrefix: "bh",
    levelPrefix: "bahrain",
    countryCode: "BH",
    countryName: "巴林",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "qa-city-centers-2026-09-06.csv",
    ),
    idPrefix: "qatar",
    codePrefix: "qa",
    levelPrefix: "qatar",
    countryCode: "QA",
    countryName: "卡塔尔",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ae-city-centers-2026-09-06.csv",
    ),
    idPrefix: "uae",
    codePrefix: "ae",
    levelPrefix: "uae",
    countryCode: "AE",
    countryName: "阿联酋",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "om-city-centers-2026-09-06.csv",
    ),
    idPrefix: "oman",
    codePrefix: "om",
    levelPrefix: "oman",
    countryCode: "OM",
    countryName: "阿曼",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "sa-city-centers-2026-09-06.csv",
    ),
    idPrefix: "saudi-arabia",
    codePrefix: "sa",
    levelPrefix: "saudi_arabia",
    countryCode: "SA",
    countryName: "沙特阿拉伯",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ye-city-centers-2026-09-06.csv",
    ),
    idPrefix: "yemen",
    codePrefix: "ye",
    levelPrefix: "yemen",
    countryCode: "YE",
    countryName: "也门",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "cy-city-centers-2026-09-06.csv",
    ),
    idPrefix: "cyprus",
    codePrefix: "cy",
    levelPrefix: "cyprus",
    countryCode: "CY",
    countryName: "塞浦路斯",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "tr-city-centers-2026-09-06.csv",
    ),
    idPrefix: "turkey",
    codePrefix: "tr",
    levelPrefix: "turkey",
    countryCode: "TR",
    countryName: "土耳其",
    continentCode: "AS",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "al-official-cities-2026-09-06.csv",
    ),
    idPrefix: "albania",
    codePrefix: "al",
    levelPrefix: "albania",
    countryCode: "AL",
    countryName: "阿尔巴尼亚",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "me-city-centers-2026-09-06.csv",
    ),
    idPrefix: "montenegro",
    codePrefix: "me",
    levelPrefix: "montenegro",
    countryCode: "ME",
    countryName: "黑山",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "ba-city-centers-2026-09-06.csv",
    ),
    idPrefix: "bosnia-herzegovina",
    codePrefix: "ba",
    levelPrefix: "bosnia_herzegovina",
    countryCode: "BA",
    countryName: "波斯尼亚和黑塞哥维那",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "hr-official-cities-2026-09-06.csv",
    ),
    idPrefix: "croatia",
    codePrefix: "hr",
    levelPrefix: "croatia",
    countryCode: "HR",
    countryName: "克罗地亚",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "rs-official-urban-settlements-2026-09-06.csv",
    ),
    idPrefix: "serbia",
    codePrefix: "rs",
    levelPrefix: "serbia",
    countryCode: "RS",
    countryName: "塞尔维亚",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "si-official-cities-2026-09-06.csv",
    ),
    idPrefix: "slovenia",
    codePrefix: "si",
    levelPrefix: "slovenia",
    countryCode: "SI",
    countryName: "斯洛文尼亚",
    continentCode: "EU",
  },
  {
    path: path.join(
      siteRoot,
      "data",
      "sources",
      "mk-official-cities-2026-09-06.csv",
    ),
    idPrefix: "north-macedonia",
    codePrefix: "mk",
    levelPrefix: "north_macedonia",
    countryCode: "MK",
    countryName: "北马其顿",
    continentCode: "EU",
  },
];

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
  const [csv, legalDecisionsCsv, legalCentersCsv, taiwanCsv] = await Promise.all([
    readSourceFile(coordinateInventoryPath),
    readSourceFile(legalCityDecisionsPath),
    readFile(legalCityCentersPath, "utf8"),
    readFile(additionalCityCenterSources[0].path, "utf8"),
  ]);
  const coordinates = new Map();

  for (const row of parseCsv(csv)) {
    if (!row.geonameid) continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    coordinates.set(String(row.geonameid), { longitude, latitude });
  }

  const legalCentersByCode = new Map(
    parseCsv(legalCentersCsv).map((row) => [row.administrative_code, row]),
  );
  for (const decision of parseCsv(legalDecisionsCsv)) {
    if (!decision.geonameid || coordinates.has(decision.geonameid)) continue;
    const center = legalCentersByCode.get(decision.administrative_code);
    const latitude = Number(center?.latitude);
    const longitude = Number(center?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    coordinates.set(String(decision.geonameid), { longitude, latitude });
  }

  // Taiwan entries already own stable map IDs; reuse the same reviewed centers.
  for (const row of parseCsv(taiwanCsv)) {
    if (!row.geonames_id) continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!row.latitude || !row.longitude ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`台湾地图中心点无效：${row.administrative_code}`);
    }
    if (coordinates.has(row.geonames_id)) {
      throw new Error(`台湾与大陆坐标库存 GeoNames ID 冲突：${row.geonames_id}`);
    }
    coordinates.set(row.geonames_id, { longitude, latitude });
  }

  return coordinates;
}

async function loadMapCities(guides) {
  const [
    inventoryCsv,
    decisionsCsv,
    centersCsv,
    cityNamesZhCsv,
    additionalCityCsvs,
  ] =
    await Promise.all([
      readSourceFile(legalCityInventoryPath),
      readSourceFile(legalCityDecisionsPath),
      readFile(legalCityCentersPath, "utf8"),
      readFile(cityNamesZhPath, "utf8"),
      Promise.all(
        additionalCityCenterSources.map((source) =>
          readFile(source.path, "utf8"),
        ),
      ),
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
  const guidesByGeonamesId = new Map(
    guides.map((guide) => [guide.geonamesId, guide]),
  );
  const cityNamesZh = new Map();
  for (const row of parseCsv(cityNamesZhCsv)) {
    const key = `${row.country_code}:${row.administrative_code}`;
    if (cityNamesZh.has(key)) {
      throw new Error(`城市中文名称存在重复键：${key}`);
    }
    if (!/[\u3400-\u9fff]/u.test(row.name_zh) || /[A-Za-z]/u.test(row.name_zh)) {
      throw new Error(`城市中文名称无效：${key}=${row.name_zh}`);
    }
    cityNamesZh.set(key, row);
  }
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
      countryCode: "CN",
      countryName: "中国",
      continentCode: "AS",
      coverage: guide ? 1 : 0,
      ...(guide ? { guideId: guide.id } : {}),
      coordinates: {
        longitude: Number(center.longitude),
        latitude: Number(center.latitude),
      },
    };
  });

  const additionalCountryCities = additionalCityCenterSources.flatMap(
    (source, sourceIndex) =>
      parseCsv(additionalCityCsvs[sourceIndex]).map((city) => {
        const localizationKey = `${source.countryCode}:${city.administrative_code}`;
        const localizedName = cityNamesZh.get(localizationKey);
        if (!localizedName && !/[\u3400-\u9fff]/u.test(city.name)) {
          throw new Error(`${localizationKey} 缺少中文城市名称：${city.name}`);
        }
        if (localizedName && localizedName.source_name !== city.name) {
          throw new Error(
            `${localizationKey} 的中文名称来源已漂移：${localizedName.source_name} != ${city.name}`,
          );
        }
        const guide = city.geonames_id
          ? guidesByGeonamesId.get(city.geonames_id)
          : undefined;
        if (guide) mappedGuideIds.add(guide.id);

        const longitude = Number(city.longitude);
        const latitude = Number(city.latitude);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
          throw new Error(`${city.name}（${city.administrative_code}）缺少有效地图中心点`);
        }

        return {
          id: `${source.idPrefix}-${city.administrative_code}`,
          administrativeCode: `${source.codePrefix}:${city.administrative_code}`,
          city: localizedName?.name_zh ?? city.name,
          adminArea: city.admin_area,
          cityLevel: `${source.levelPrefix}_${city.city_level}`,
          countryCode: source.countryCode,
          countryName: source.countryName,
          continentCode: source.continentCode,
          coverage: guide ? 1 : 0,
          ...(guide ? { guideId: guide.id } : {}),
          coordinates: { longitude, latitude },
        };
      }),
  );

  const additionalGuideDestinations = guides
    .filter((guide) => !mappedGuideIds.has(guide.id))
    .map((guide) => ({
      id: `guide-${guide.id}`,
      administrativeCode: `geonames:${guide.geonamesId}`,
      city: guide.city,
      adminArea: guide.adminArea,
      cityLevel: "guide_destination",
      countryCode: "CN",
      countryName: "中国",
      continentCode: "AS",
      coverage: 1,
      guideId: guide.id,
      coordinates: guide.coordinates,
    }));

  const mapCities = [
    ...legalCities,
    ...additionalCountryCities,
    ...additionalGuideDestinations,
  ];
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
    /^\|\s*(?:\*\*|__)?(?:建议停留|停留)(?:\*\*|__)?\s*\|\s*([^|\n]+?)\s*\|\s*$/m,
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
    (field) =>
      data[field] === undefined ||
      data[field] === "" ||
      (data[field] === null && field !== "wikidata_id"),
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
    const wikidataId =
      parsed.data.wikidata_id === null
        ? null
        : String(parsed.data.wikidata_id).trim();
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
  wikidataId: string | null;
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
  countryCode: string;
  countryName: string;
  continentCode: string;
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

  const mapCities = await loadMapCities(cityResult.guides);
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
