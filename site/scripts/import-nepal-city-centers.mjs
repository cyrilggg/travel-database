import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, "..");
const outputPath = path.join(
  siteRoot,
  "data",
  "sources",
  "np-urban-municipalities-2026-09-06.csv",
);

const officialCodeUrl = "https://ec.nsonepal.gov.np/html/admin_code.html";
const boundaryUrl =
  "https://localboundries.oknp.org/data/local-level/nepal.geojson";
const expectedOfficialHash =
  "C7EEEFDAF7CD03CB797E54BB1C1CB6E8ECDD4B5A204919166B573663D442CE61";
const expectedBoundaryHash =
  "CCB2C0EE43EB997AF724DF65B3C262C9DAE441E8983448A812AFC053087B97B2";

const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").toUpperCase();

async function download(url, expectedHash) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} 下载失败：HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(buffer);
  if (actualHash !== expectedHash) {
    throw new Error(`${url} 快照哈希变化：${actualHash}`);
  }
  return buffer;
}

function officialRowsFromHtml(html) {
  const match = html.match(/const ROWS=(\[[\s\S]*?\]);\s*\n/);
  if (!match) throw new Error("官方代码页中未找到 ROWS 数据");
  return JSON.parse(match[1]);
}

function cityLevelForOfficialName(name) {
  if (name.endsWith("Sub-Metropolitan City")) {
    return "sub_metropolitan_city";
  }
  if (name.endsWith("Metropolitan City")) return "metropolitan_city";
  if (name.endsWith("Municipality")) return "municipality";
  return null;
}

function cityNameForOfficialName(name) {
  return name
    .replace(/\s+Sub-Metropolitan City$/, "")
    .replace(/\s+Metropolitan City$/, "")
    .replace(/\s+Municipality$/, "")
    .trim();
}

const boundaryTypeByLevel = {
  metropolitan_city: "Mahanagarpalika",
  sub_metropolitan_city: "Upamahanagarpalika",
  municipality: "Nagarpalika",
};

function normalizedName(value) {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll("municipality", "")
    .replaceAll("submetropolitancity", "")
    .replaceAll("metropolitancity", "")
    .replace(/[^a-z0-9]/g, "");
  const boundarySnapshotAliases = {
    barahachhetra: "barah",
    pokhara: "pokharalekhnath",
    bherimalika: "bheri",
    nalgad: "tribeninalagad",
    dodharachadani: "mahakali",
  };
  return boundarySnapshotAliases[normalized] ?? normalized;
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function nameDistance(left, right) {
  const normalizedLeft = normalizedName(left);
  const normalizedRight = normalizedName(right);
  return (
    levenshtein(normalizedLeft, normalizedRight) /
    Math.max(normalizedLeft.length, normalizedRight.length, 1)
  );
}

function groupedBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function districtAssignments(officialCities, boundaryCities) {
  const officialGroups = groupedBy(
    officialCities,
    (city) => `${city.pCode}:${city.dCode}`,
  );
  const boundaryGroups = groupedBy(
    boundaryCities,
    (feature) =>
      `${feature.properties.STATE_CODE}:${feature.properties.DISTRICT}`,
  );
  const assignments = new Map();

  for (let province = 1; province <= 7; province += 1) {
    const provinceOfficialGroups = [...officialGroups.entries()].filter(
      ([key]) => key.startsWith(`${province}:`),
    );
    const provinceBoundaryGroups = [...boundaryGroups.entries()].filter(
      ([key]) => key.startsWith(`${province}:`),
    );
    const pairs = [];

    for (const [officialKey, officials] of provinceOfficialGroups) {
      for (const [boundaryKey, boundaries] of provinceBoundaryGroups) {
        const exactMatches = officials.filter((official) =>
          boundaries.some(
            (boundary) =>
              boundary.properties.Type_GN ===
                boundaryTypeByLevel[official.cityLevel] &&
              normalizedName(boundary.properties.GaPa_NaPa) ===
                normalizedName(official.city),
          ),
        ).length;
        const nearestTotal = officials.reduce((total, official) => {
          const sameType = boundaries.filter(
            (boundary) =>
              boundary.properties.Type_GN ===
              boundaryTypeByLevel[official.cityLevel],
          );
          return (
            total +
            Math.min(
              ...sameType.map((boundary) =>
                nameDistance(official.city, boundary.properties.GaPa_NaPa),
              ),
              1,
            )
          );
        }, 0);
        pairs.push({
          officialKey,
          boundaryKey,
          score:
            exactMatches * 100 -
            nearestTotal * 10 -
            Math.abs(officials.length - boundaries.length) * 2,
        });
      }
    }

    const usedOfficial = new Set();
    const usedBoundary = new Set();
    for (const pair of pairs.sort((left, right) => right.score - left.score)) {
      if (
        usedOfficial.has(pair.officialKey) ||
        usedBoundary.has(pair.boundaryKey)
      ) {
        continue;
      }
      usedOfficial.add(pair.officialKey);
      usedBoundary.add(pair.boundaryKey);
      assignments.set(pair.officialKey, pair.boundaryKey);
    }
  }

  if (assignments.size !== officialGroups.size) {
    throw new Error("未能为每个官方地区匹配边界地区");
  }
  return { assignments, boundaryGroups };
}

function matchCities(officialCities, boundaryCities) {
  const { assignments, boundaryGroups } = districtAssignments(
    officialCities,
    boundaryCities,
  );
  const officialGroups = groupedBy(
    officialCities,
    (city) => `${city.pCode}:${city.dCode}`,
  );
  const matches = [];

  for (const [officialKey, officials] of officialGroups) {
    const boundaries = boundaryGroups.get(assignments.get(officialKey)) ?? [];
    const pairs = officials.flatMap((official) =>
      boundaries
        .filter(
          (boundary) =>
            boundary.properties.Type_GN ===
            boundaryTypeByLevel[official.cityLevel],
        )
        .map((boundary) => ({
          official,
          boundary,
          distance: nameDistance(
            official.city,
            boundary.properties.GaPa_NaPa,
          ),
        })),
    );
    const usedOfficial = new Set();
    const usedBoundary = new Set();

    for (const pair of pairs.sort(
      (left, right) => left.distance - right.distance,
    )) {
      if (
        usedOfficial.has(pair.official.llCode) ||
        usedBoundary.has(pair.boundary)
      ) {
        continue;
      }
      usedOfficial.add(pair.official.llCode);
      usedBoundary.add(pair.boundary);
      matches.push(pair);
    }

    if (usedOfficial.size !== officials.length) {
      throw new Error(`${officialKey} 的城市与边界没有一一匹配`);
    }
  }

  const weakMatches = matches.filter((match) => match.distance > 0.45);
  if (weakMatches.length) {
    throw new Error(
      `存在低可信名称匹配：${weakMatches
        .map(
          ({ official, boundary, distance }) =>
            `${official.city} -> ${boundary.properties.GaPa_NaPa} (${distance.toFixed(2)})`,
        )
        .join("；")}`,
    );
  }
  return matches;
}

function ringCentroid(ring) {
  let twiceArea = 0;
  let longitudeTotal = 0;
  let latitudeTotal = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitude1, latitude1] = ring[index];
    const [longitude2, latitude2] = ring[index + 1];
    const cross = longitude1 * latitude2 - longitude2 * latitude1;
    twiceArea += cross;
    longitudeTotal += (longitude1 + longitude2) * cross;
    latitudeTotal += (latitude1 + latitude2) * cross;
  }
  if (Math.abs(twiceArea) < Number.EPSILON) return null;
  return {
    area: twiceArea / 2,
    point: [
      longitudeTotal / (3 * twiceArea),
      latitudeTotal / (3 * twiceArea),
    ],
  };
}

function pointInRing(point, ring) {
  const [longitude, latitude] = point;
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [longitude1, latitude1] = ring[index];
    const [longitude2, latitude2] = ring[previous];
    if (
      latitude1 > latitude !== latitude2 > latitude &&
      longitude <
        ((longitude2 - longitude1) * (latitude - latitude1)) /
          (latitude2 - latitude1) +
          longitude1
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonsForGeometry(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`不支持的边界类型：${geometry.type}`);
}

function pointInGeometry(point, geometry) {
  return polygonsForGeometry(geometry).some(
    (polygon) =>
      pointInRing(point, polygon[0]) &&
      polygon.slice(1).every((hole) => !pointInRing(point, hole)),
  );
}

function representativePoint(geometry) {
  const polygons = polygonsForGeometry(geometry);
  const centroids = polygons
    .map((polygon) => ringCentroid(polygon[0]))
    .filter(Boolean);
  const totalWeight = centroids.reduce(
    (sum, centroid) => sum + Math.abs(centroid.area),
    0,
  );
  const centroid = [
    centroids.reduce(
      (sum, item) => sum + item.point[0] * Math.abs(item.area),
      0,
    ) / totalWeight,
    centroids.reduce(
      (sum, item) => sum + item.point[1] * Math.abs(item.area),
      0,
    ) / totalWeight,
  ];
  if (pointInGeometry(centroid, geometry)) return centroid;

  const points = polygons.flatMap((polygon) => polygon[0]);
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  const bounds = {
    minimumLongitude: Math.min(...longitudes),
    maximumLongitude: Math.max(...longitudes),
    minimumLatitude: Math.min(...latitudes),
    maximumLatitude: Math.max(...latitudes),
  };
  let best = null;
  for (let x = 0; x <= 80; x += 1) {
    for (let y = 0; y <= 80; y += 1) {
      const point = [
        bounds.minimumLongitude +
          ((bounds.maximumLongitude - bounds.minimumLongitude) * x) / 80,
        bounds.minimumLatitude +
          ((bounds.maximumLatitude - bounds.minimumLatitude) * y) / 80,
      ];
      if (!pointInGeometry(point, geometry)) continue;
      const distance =
        (point[0] - centroid[0]) ** 2 + (point[1] - centroid[1]) ** 2;
      if (!best || distance < best.distance) best = { point, distance };
    }
  }
  if (best) return best.point;
  return polygons[0][0][0];
}

function displayDistrict(value) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const [officialBuffer, boundaryBuffer] = await Promise.all([
  download(officialCodeUrl, expectedOfficialHash),
  download(boundaryUrl, expectedBoundaryHash),
]);
const officialRows = officialRowsFromHtml(officialBuffer.toString("utf8"));
const officialCities = officialRows
  .map((row) => ({
    ...row,
    cityLevel: cityLevelForOfficialName(row.llEn),
    city: cityNameForOfficialName(row.llEn),
  }))
  .filter((row) => row.cityLevel);
const boundaryData = JSON.parse(boundaryBuffer.toString("utf8"));
const boundaryCities = boundaryData.features.filter((feature) =>
  Object.values(boundaryTypeByLevel).includes(feature.properties.Type_GN),
);

if (officialRows.length !== 753 || officialCities.length !== 293) {
  throw new Error(
    `官方清单数量异常：${officialRows.length} 个地方政府、${officialCities.length} 个城市型单位`,
  );
}

const matches = matchCities(officialCities, boundaryCities);
const outputRows = matches
  .map(({ official, boundary, distance }) => {
    const [longitude, latitude] = representativePoint(boundary.geometry);
    return {
      administrativeCode: String(official.llCode).padStart(5, "0"),
      name: official.city,
      adminArea: displayDistrict(boundary.properties.DISTRICT),
      cityLevel:
        official.city === "Kathmandu" &&
        official.cityLevel === "metropolitan_city"
          ? "capital_metropolitan_city"
          : official.cityLevel,
      geonamesId: "",
      longitude: longitude.toFixed(6),
      latitude: latitude.toFixed(6),
      distance,
    };
  })
  .sort((left, right) =>
    left.administrativeCode.localeCompare(right.administrativeCode),
  );

const rows = [
  [
    "administrative_code",
    "name",
    "admin_area",
    "city_level",
    "geonames_id",
    "longitude",
    "latitude",
  ],
  ...outputRows.map((row) => [
    row.administrativeCode,
    row.name,
    row.adminArea,
    row.cityLevel,
    row.geonamesId,
    row.longitude,
    row.latitude,
  ]),
].map((row) => row.map(csvCell).join(","));

await writeFile(outputPath, `${rows.join("\n")}\n`, "utf8");
const counts = Object.groupBy(outputRows, (row) => row.cityLevel);
const weakest = [...outputRows]
  .sort((left, right) => right.distance - left.distance)
  .slice(0, 10)
  .map((row) => `${row.name}(${row.distance.toFixed(2)})`)
  .join(", ");
console.log(
  `已生成 ${outputRows.length} 个尼泊尔城市型地方政府：${Object.entries(counts)
    .map(([level, cities]) => `${level}=${cities.length}`)
    .join(", ")}`,
);
console.log(`名称匹配距离最高的 10 项：${weakest}`);
console.log(`官方清单 SHA-256：${expectedOfficialHash}`);
console.log(`边界快照 SHA-256：${expectedBoundaryHash}`);
