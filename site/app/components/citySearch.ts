import type { MapCity } from "../generated/publicGuides";

const shortName = (name: string) => name.replace(/[市区]$/, "");
const normalize = (value: string) => value.trim().toLocaleLowerCase("zh-CN");
export const citySearchLabel = (city: MapCity) =>
  [shortName(city.city), ...new Set([city.adminArea, city.countryName])].join(" · ");

export function findMapCity(cities: MapCity[], query: string): MapCity | undefined {
  const text = normalize(query);
  if (!text) return undefined;
  return cities.find(city => normalize(citySearchLabel(city)) === text)
    ?? cities.find(city => normalize(city.city) === text || normalize(shortName(city.city)) === text)
    ?? cities.find(city => normalize(city.city).includes(text))
    ?? cities.find(city => normalize(`${city.adminArea} ${city.countryName}`).includes(text));
}
