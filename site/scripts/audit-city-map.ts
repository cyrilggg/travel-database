import { mkdir, writeFile } from "node:fs/promises";
import { mapCities } from "../app/generated/publicGuides";
import { cityLevelPolicyOf } from "../app/components/administrativeType";
import { visibleMapCities, isDefaultMapDestination } from "../app/components/cityMapVisibility";
import worldSources from "../data/world-major-cities.sources.json";

const countries = [...new Set(mapCities.map(city => city.countryCode))].sort();
const report = {
  inventory: mapCities.length,
  guideDestinations: mapCities.filter(city => city.coverage === 1).length,
  defaultCatalog: mapCities.filter(isDefaultMapDestination).length,
  worldCoverage: {
    expectedMemberAndObserverStates: worldSources.expectedCountryCodes.length,
    missing: worldSources.expectedCountryCodes.filter(code => !countries.includes(code)),
    majorCityAdditions: mapCities.filter(city => city.id.startsWith("world-")).length,
  },
  countries: countries.map(countryCode => {
    const cities = mapCities.filter(city => city.countryCode === countryCode);
    return {
      countryCode,
      inventory: cities.length,
      overview: visibleMapCities(cities, 6).length,
      cityZoom: visibleMapCities(cities, 7).length,
      localZoom: visibleMapCities(cities, 9).length,
      needsReview: cities.filter(city => !isDefaultMapDestination(city)).map(city => ({
        id: city.id, name: city.city, adminArea: city.adminArea,
        sourceLevel: city.cityLevel, reason: cityLevelPolicyOf(city).label,
      })),
    };
  }),
};
const directory = new URL("../outputs/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("city-map-audit.json", directory), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({inventory: report.inventory, defaultCatalog: report.defaultCatalog,
  needsReview: report.inventory - report.defaultCatalog, countries: countries.length}));
