import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const officialCitiesPath = process.argv[2];
const geonamesPath = process.argv[3];
const outputPath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(siteRoot, "data", "jp-city-centers.csv");

if (!officialCitiesPath || !geonamesPath) {
  throw new Error(
    "用法：node scripts/import-japan-city-centers.mjs <e-Stat 市级 CSV> <GeoNames JP.txt> [输出路径]",
  );
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

  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, ""));
  if (!headers) return [];
  return rows
    .filter((columns) => columns.some(Boolean))
    .map((columns) =>
      Object.fromEntries(
        headers.map((header, index) => [header, columns[index] ?? ""]),
      ),
    );
}

function parseGeonames(tsv) {
  return tsv
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const columns = line.split("\t");
      return {
        id: columns[0],
        name: columns[1],
        asciiName: columns[2],
        alternateNames: columns[3] ? columns[3].split(",") : [],
        latitude: Number(columns[4]),
        longitude: Number(columns[5]),
        featureClass: columns[6],
        featureCode: columns[7],
        countryCode: columns[8],
        admin1Code: columns[10],
        population: Number(columns[14]) || 0,
      };
    });
}

function namesOf(place) {
  return new Set([place.name, place.asciiName, ...place.alternateNames]);
}

function csvValue(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const [officialCsv, geonamesTsv] = await Promise.all([
  readFile(path.resolve(officialCitiesPath), "utf8"),
  readFile(path.resolve(geonamesPath), "utf8"),
]);

const officialCities = parseCsv(officialCsv).map((row) => {
  const administrativeCode = row["標準地域コード"];
  const officialName = row["市区町村"] || row["政令市･郡･支庁･振興局等"];
  if (!/^\d{5}$/.test(administrativeCode)) {
    throw new Error(`日本城市的标准地区代码无效：${administrativeCode}`);
  }
  if (administrativeCode !== "13100" && !officialName.endsWith("市")) {
    throw new Error(`${administrativeCode} 不是市或东京特别区部：${officialName}`);
  }
  return {
    administrativeCode,
    officialName,
    displayName: administrativeCode === "13100" ? "東京" : officialName,
    adminArea: row["都道府県"],
    cityLevel:
      administrativeCode === "13100" ? "special_ward_area" : "municipal_city",
  };
});

if (officialCities.length !== 793) {
  throw new Error(`e-Stat 市级清单应为 793 条，实际为 ${officialCities.length} 条`);
}
if (new Set(officialCities.map((city) => city.administrativeCode)).size !== 793) {
  throw new Error("e-Stat 市级清单存在重复标准地区代码");
}

const geonames = parseGeonames(geonamesTsv);
const admin1Places = geonames.filter(
  (place) => place.featureClass === "A" && place.featureCode === "ADM1",
);
const admin2Places = geonames.filter(
  (place) => place.featureClass === "A" && place.featureCode === "ADM2",
);
const populatedPlaces = geonames.filter((place) => place.featureClass === "P");

const prefectureCodes = new Map();
for (const city of officialCities) {
  if (prefectureCodes.has(city.adminArea)) continue;
  const matches = admin1Places.filter((place) => namesOf(place).has(city.adminArea));
  if (matches.length !== 1) {
    throw new Error(
      `${city.adminArea} 对应 ${matches.length} 个 GeoNames 一级行政区，无法唯一匹配`,
    );
  }
  prefectureCodes.set(city.adminArea, matches[0].admin1Code);
}

const featurePriority = new Map([
  ["PPLC", 5],
  ["PPLA", 4],
  ["PPLA2", 3],
  ["PPLA3", 2],
  ["PPL", 1],
]);

const resolved = [];
const unmatched = [];
const ambiguous = [];
let pointFallbackCount = 0;

for (const city of officialCities) {
  const admin1Code = prefectureCodes.get(city.adminArea);
  let candidates;

  if (city.administrativeCode === "13100") {
    candidates = populatedPlaces.filter(
      (place) =>
        place.admin1Code === admin1Code &&
        (namesOf(place).has("東京") || namesOf(place).has("Tokyo")) &&
        place.featureCode === "PPLC",
    );
  } else {
    candidates = admin2Places.filter(
      (place) =>
        place.admin1Code === admin1Code && namesOf(place).has(city.officialName),
    );
  }

  if (candidates.length === 0) {
    candidates = populatedPlaces
      .filter(
        (place) =>
          place.admin1Code === admin1Code && namesOf(place).has(city.officialName),
      )
      .sort(
        (left, right) =>
          (featurePriority.get(right.featureCode) ?? 0) -
            (featurePriority.get(left.featureCode) ?? 0) ||
          right.population - left.population,
      );
    if (candidates.length > 0) pointFallbackCount += 1;
  }

  if (candidates.length === 0) {
    unmatched.push(city);
    continue;
  }
  if (candidates.length > 1) {
    const first = candidates[0];
    const second = candidates[1];
    const firstPriority = featurePriority.get(first.featureCode) ?? 0;
    const secondPriority = featurePriority.get(second.featureCode) ?? 0;
    if (
      first.featureClass === second.featureClass &&
      firstPriority === secondPriority &&
      first.population === second.population
    ) {
      ambiguous.push({ city, candidates });
      continue;
    }
  }

  const place = candidates[0];
  resolved.push({ ...city, place });
}

if (unmatched.length || ambiguous.length) {
  console.error(
    JSON.stringify(
      {
        unmatched: unmatched.map((city) => ({
          code: city.administrativeCode,
          name: city.officialName,
          adminArea: city.adminArea,
        })),
        ambiguous: ambiguous.map(({ city, candidates }) => ({
          code: city.administrativeCode,
          name: city.officialName,
          adminArea: city.adminArea,
          candidates: candidates.map((place) => ({
            id: place.id,
            name: place.name,
            featureCode: place.featureCode,
          })),
        })),
      },
      null,
      2,
    ),
  );
  throw new Error(
    `日本城市中心点仍有 ${unmatched.length} 条未匹配、${ambiguous.length} 条歧义`,
  );
}

const header = [
  "administrative_code",
  "name",
  "admin_area",
  "city_level",
  "geonames_id",
  "longitude",
  "latitude",
];
const rows = resolved.map((city) => [
  city.administrativeCode,
  city.displayName,
  city.adminArea,
  city.cityLevel,
  city.place.id,
  city.place.longitude.toFixed(6),
  city.place.latitude.toFixed(6),
]);
await writeFile(
  outputPath,
  `${[header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n")}\n`,
  "utf8",
);

console.log(
  `已生成 ${resolved.length} 个日本城市中心点；${pointFallbackCount} 个使用城市点，其余使用行政区中心点`,
);
