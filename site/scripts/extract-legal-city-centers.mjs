import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(siteRoot, "..");
const sourcePath = process.argv[2];
const outputPath = path.join(siteRoot, "data", "cn-legal-city-centers.csv");

if (!sourcePath) {
  throw new Error("请提供 AreaCity ok_geo.csv 的路径");
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
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
      values.push(value);
      value = "";
      if (values.length === 6) return values;
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function transformLatitude(longitude, latitude) {
  let result = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude ** 2;
  result += 0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude));
  result += ((20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(latitude * Math.PI) + 40 * Math.sin((latitude / 3) * Math.PI)) * 2) / 3;
  result += ((160 * Math.sin((latitude / 12) * Math.PI) + 320 * Math.sin((latitude * Math.PI) / 30)) * 2) / 3;
  return result;
}

function transformLongitude(longitude, latitude) {
  let result = 300 + longitude + 2 * latitude + 0.1 * longitude ** 2;
  result += 0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude));
  result += ((20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(longitude * Math.PI) + 40 * Math.sin((longitude / 3) * Math.PI)) * 2) / 3;
  result += ((150 * Math.sin((longitude / 12) * Math.PI) + 300 * Math.sin((longitude / 30) * Math.PI)) * 2) / 3;
  return result;
}

function gcj02ToWgs84(longitude, latitude) {
  const earthRadius = 6378245;
  const eccentricity = 0.006693421622965943;
  const deltaLatitude = transformLatitude(longitude - 105, latitude - 35);
  const deltaLongitude = transformLongitude(longitude - 105, latitude - 35);
  const radians = (latitude / 180) * Math.PI;
  let magic = Math.sin(radians);
  magic = 1 - eccentricity * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const latitudeOffset =
    (deltaLatitude * 180) /
    (((earthRadius * (1 - eccentricity)) / (magic * sqrtMagic)) * Math.PI);
  const longitudeOffset =
    (deltaLongitude * 180) /
    ((earthRadius / sqrtMagic) * Math.cos(radians) * Math.PI);
  return {
    longitude: longitude * 2 - (longitude + longitudeOffset),
    latitude: latitude * 2 - (latitude + latitudeOffset),
  };
}

function coordinateKey(city) {
  if (city.city_level === "direct_municipality") return city.administrative_code.slice(0, 2);
  if (city.city_level === "prefecture_level_city") return city.administrative_code.slice(0, 4);
  return city.administrative_code;
}

const legalCities = parseCsv(
  await readFile(
    path.join(projectRoot, "coverage", "legal-cities", "2025-12-31", "inventory", "CN-legal-cities.csv"),
    "utf8",
  ),
);
const requiredKeys = new Set(legalCities.map(coordinateKey));
const sourceCoordinates = new Map();
// 草湖市晚于上游三级边界快照设立；中心点采用其政府驻地草湖镇。
sourceCoordinates.set("659013", { longitude: 79.133333, latitude: 39.916667 });
const source = readline.createInterface({ input: createReadStream(sourcePath, "utf8"), crlfDelay: Infinity });

for await (const line of source) {
  const [id, , , , , coordinate] = parseCsvLine(line);
  if (!requiredKeys.has(id) || !coordinate || coordinate === "EMPTY") continue;
  const [longitude, latitude] = coordinate.split(/\s+/).map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
  sourceCoordinates.set(id, gcj02ToWgs84(longitude, latitude));
}

const missing = legalCities.filter((city) => !sourceCoordinates.has(coordinateKey(city)));
if (missing.length) {
  throw new Error(`以下目标城市没有中心点：${missing.map((city) => city.name).join("、")}`);
}

const rows = legalCities.map((city) => {
  const coordinate = sourceCoordinates.get(coordinateKey(city));
  return [
    city.administrative_code,
    city.name,
    coordinate.longitude.toFixed(6),
    coordinate.latitude.toFixed(6),
  ].join(",");
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `administrative_code,name,longitude,latitude\n${rows.join("\n")}\n`,
  "utf8",
);
console.log(`已生成 ${rows.length} 座目标城市中心点`);
