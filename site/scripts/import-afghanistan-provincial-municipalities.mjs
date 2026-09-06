import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const outputPath = path.join(
  siteRoot,
  "data",
  "sources",
  "af-provincial-municipalities-2026-09-06.csv",
);

const expectedGeoNamesHash =
  "3769309D6CABF3CC7B53075A7C5028F99ADBAC9A6DF6059345050FD714E8A112";

const municipalityByAdmin1 = {
  "01": { province: "Badakhshan", city: "Fayzabad" },
  "02": { province: "Badghis", city: "Qala-e-Naw" },
  "03": { province: "Baghlan", city: "Pul-e Khumri" },
  "05": { province: "Bamyan", city: "Bamyan" },
  "06": { province: "Farah", city: "Farah" },
  "07": { province: "Faryab", city: "Maymana" },
  "08": { province: "Ghazni", city: "Ghazni" },
  "09": { province: "Ghor", city: "Firozkoh" },
  "10": { province: "Helmand", city: "Lashkar Gah" },
  "11": { province: "Herat", city: "Herat" },
  "13": { province: "Kabul", city: "Kabul" },
  "14": { province: "Kapisa", city: "Mahmud-i-Raqi" },
  "17": { province: "Logar", city: "Pul-e Alam" },
  "18": { province: "Nangarhar", city: "Jalalabad" },
  "19": { province: "Nimroz", city: "Zaranj" },
  "23": { province: "Kandahar", city: "Kandahar" },
  "24": { province: "Kunduz", city: "Kunduz" },
  "26": { province: "Takhar", city: "Taloqan" },
  "27": { province: "Maidan Wardak", city: "Maidan Shahr" },
  "28": { province: "Zabul", city: "Qalat" },
  "29": { province: "Paktika", city: "Sharana" },
  "30": { province: "Balkh", city: "Mazar-e Sharif" },
  "31": { province: "Jowzjan", city: "Sheberghan" },
  "32": { province: "Samangan", city: "Aybak" },
  "33": { province: "Sar-e Pol", city: "Sar-e Pol" },
  "34": { province: "Kunar", city: "Asadabad" },
  "35": { province: "Laghman", city: "Mehtar Lam" },
  "36": { province: "Paktia", city: "Gardez" },
  "37": { province: "Khost", city: "Khost" },
  "38": { province: "Nuristan", city: "Parun" },
  "39": { province: "Uruzgan", city: "Tarinkot" },
  "40": { province: "Parwan", city: "Charikar" },
  "41": { province: "Daykundi", city: "Nili" },
  "42": { province: "Panjshir", city: "Bazarak" },
};

const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").toUpperCase();

const csvCell = (value) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error(
    "用法：node scripts/import-afghanistan-provincial-municipalities.mjs <AF.txt> [output.csv]",
  );
}

const inputBuffer = await readFile(path.resolve(inputPath));
const actualHash = sha256(inputBuffer);
if (actualHash !== expectedGeoNamesHash) {
  throw new Error(`GeoNames AF.txt 快照哈希变化：${actualHash}`);
}

const placeRows = inputBuffer
  .toString("utf8")
  .trimEnd()
  .split("\n")
  .map((line) => line.replace(/\r$/, "").split("\t"))
  .filter((fields) => fields[7] === "PPLA" || fields[7] === "PPLC");

if (placeRows.length !== 34) {
  throw new Error(`省级首府中心点数量异常：${placeRows.length}`);
}

const outputRows = placeRows.map((fields) => {
  const geonamesId = fields[0];
  const longitude = Number(fields[5]);
  const latitude = Number(fields[4]);
  const admin1 = fields[10];
  const municipality = municipalityByAdmin1[admin1];
  if (!municipality) throw new Error(`缺少 admin1=${admin1} 的省级 Municipality`);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`${municipality.city} 缺少有效中心点`);
  }
  return {
    administrative_code: geonamesId,
    name: municipality.city,
    admin_area: municipality.province,
    city_level:
      municipality.city === "Kabul"
        ? "capital_municipality"
        : "provincial_municipality",
    geonames_id: geonamesId,
    longitude: longitude.toFixed(6),
    latitude: latitude.toFixed(6),
  };
});

if (new Set(outputRows.map((row) => row.administrative_code)).size !== 34) {
  throw new Error("生成结果存在重复稳定 ID");
}
if (new Set(outputRows.map((row) => row.admin_area)).size !== 34) {
  throw new Error("生成结果没有逐一覆盖 34 个省级 Municipality");
}

outputRows.sort((left, right) =>
  left.admin_area.localeCompare(right.admin_area, "en"),
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

const targetPath = path.resolve(process.argv[3] ?? outputPath);
await writeFile(targetPath, `${csv}\n`, "utf8");
console.log(`已生成 ${outputRows.length} 个阿富汗省级 Municipality 城市点`);
