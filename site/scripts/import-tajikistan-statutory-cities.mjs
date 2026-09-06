import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const defaultOutput = path.join(
  siteRoot,
  "data",
  "sources",
  "tj-statutory-cities-2025.csv",
);

const expectedStatisticsHash =
  "A17B41044EA3459E5D2833F66FECFC01D725C8FBE7F8275B5F9E6A2B09AC4665";
const expectedGeoNamesHash =
  "E6C078F5D4BA9CE12A5EED70C7757C418CC7B8E758DC16F94DF49C0539FEB1B8";

// The current 18-city register transcribed from the official 2025 population
// and administrative-territorial tables. GeoNames ids are used as stable ids
// because the published national table does not include a city code column.
const cities = [
  ["1221874", "Dushanbe", "Dushanbe", "capital_city"],
  ["1220855", "Vahdat", "Districts of Republican Subordination", "republic_subordinate_city"],
  ["1220701", "Roghun", "Districts of Republican Subordination", "republic_subordinate_city"],
  ["1282601", "Tursunzoda", "Districts of Republican Subordination", "republic_subordinate_city"],
  ["1221714", "Hisor", "Districts of Republican Subordination", "republic_subordinate_city"],
  ["1514879", "Khujand", "Sughd Region", "regional_city"],
  ["1514829", "Istiqlol", "Sughd Region", "regional_city"],
  ["1514883", "Guliston", "Sughd Region", "regional_city"],
  ["1538311", "Buston", "Sughd Region", "regional_city"],
  ["1220253", "Istaravshan", "Sughd Region", "regional_city"],
  ["1514896", "Isfara", "Sughd Region", "regional_city"],
  ["1514891", "Konibodom", "Sughd Region", "regional_city"],
  ["1220798", "Panjakent", "Sughd Region", "regional_city"],
  ["1220747", "Bokhtar", "Khatlon Region", "regional_city"],
  ["1221194", "Kulob", "Khatlon Region", "regional_city"],
  ["1220905", "Norak", "Khatlon Region", "regional_city"],
  ["1221549", "Levakant", "Khatlon Region", "regional_city"],
  ["1221328", "Khorugh", "Gorno-Badakhshan Autonomous Region", "regional_city"],
];

const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").toUpperCase();

const csvCell = (value) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const statisticsPath = process.argv[2];
const geoNamesPath = process.argv[3];
if (!statisticsPath || !geoNamesPath) {
  throw new Error(
    "用法：node scripts/import-tajikistan-statutory-cities.mjs " +
      "<population-2025.pdf> <TJ.txt> [output.csv]",
  );
}

const statisticsBuffer = await readFile(path.resolve(statisticsPath));
const geoNamesBuffer = await readFile(path.resolve(geoNamesPath));
if (sha256(statisticsBuffer) !== expectedStatisticsHash) {
  throw new Error(`塔吉克斯坦统计 PDF 快照哈希变化：${sha256(statisticsBuffer)}`);
}
if (sha256(geoNamesBuffer) !== expectedGeoNamesHash) {
  throw new Error(`GeoNames TJ.txt 快照哈希变化：${sha256(geoNamesBuffer)}`);
}

if (cities.length !== 18 || new Set(cities.map(([id]) => id)).size !== 18) {
  throw new Error("塔吉克斯坦城市清单应包含 18 个唯一稳定 ID");
}

const placesById = new Map(
  geoNamesBuffer
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => line.replace(/\r$/, "").split("\t"))
    .map((fields) => [fields[0], fields]),
);

const outputRows = cities.map(([geonamesId, name, adminArea, cityLevel]) => {
  const fields = placesById.get(geonamesId);
  if (!fields || fields[6] !== "P") {
    throw new Error(`${name} 缺少固定的 GeoNames 城市中心点 ${geonamesId}`);
  }
  const longitude = Number(fields[5]);
  const latitude = Number(fields[4]);
  if (!(longitude >= 67 && longitude <= 75 && latitude >= 36.5 && latitude <= 41.5)) {
    throw new Error(`${name} 中心点超出塔吉克斯坦范围`);
  }
  return {
    administrative_code: geonamesId,
    name,
    admin_area: adminArea,
    city_level: cityLevel,
    geonames_id: geonamesId,
    longitude: longitude.toFixed(6),
    latitude: latitude.toFixed(6),
  };
});

if (
  new Set(outputRows.map(({ longitude, latitude }) => `${longitude},${latitude}`)).size !==
  outputRows.length
) {
  throw new Error("塔吉克斯坦城市清单存在重复中心坐标");
}

outputRows.sort((left, right) =>
  `${left.admin_area}\0${left.name}`.localeCompare(
    `${right.admin_area}\0${right.name}`,
    "en",
  ),
);

const headers = [
  "administrative_code",
  "name",
  "admin_area",
  "city_level",
  "geonames_id",
  "longitude",
  "latitude",
];
const csv = [
  headers.join(","),
  ...outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
].join("\n");

const outputPath = path.resolve(process.argv[4] ?? defaultOutput);
await writeFile(outputPath, `${csv}\n`, "utf8");
console.log("已生成 18 个塔吉克斯坦法定城市中心点");
