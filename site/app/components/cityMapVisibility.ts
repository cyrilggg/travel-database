import type { MapCity } from "../generated/publicGuides";
import { cityLevelPolicyOf } from "./administrativeType";

export const CITY_CLUSTER_OPTIONS = { clusterMaxZoom: 12, clusterRadius: 64 };
export const cityZoomBand = (zoom: number) => zoom < 7 ? 0 : zoom < 9 ? 7 : zoom < 10 ? 9 : 10;
export const cityZoomHint = (zoom: number) => zoom < 7
  ? "概览 · 放大查看更多"
  : zoom < 9 ? "城市 · 放大查看地方中心" : "城市与地方目的地";

export const isDefaultMapDestination = (city: MapCity) =>
  city.coverage === 1 || !cityLevelPolicyOf(city).reviewRequired;

export function isCityVisibleAtZoom(city: MapCity, zoom: number): boolean {
  if (city.coverage === 1) return true;
  const policy = cityLevelPolicyOf(city);
  return !policy.reviewRequired && policy.minZoom !== null && zoom >= policy.minZoom;
}

export function visibleMapCities(cities: MapCity[], zoom: number): MapCity[] {
  // Some inventories only distinguish one kind of city (e.g. county seats).
  // Keep their best documented tier available as clusters rather than making
  // a whole country vanish or inventing capital status from a translated name.
  const firstTier = new Map<string, number>();
  for (const city of cities) {
    const policy = cityLevelPolicyOf(city);
    if (policy.reviewRequired || policy.minZoom === null) continue;
    firstTier.set(city.countryCode, Math.min(firstTier.get(city.countryCode) ?? Infinity, policy.minZoom));
  }
  return cities.filter(city => {
    if (isCityVisibleAtZoom(city, zoom)) return true;
    const policy = cityLevelPolicyOf(city);
    return !policy.reviewRequired && policy.minZoom !== null && policy.minZoom === firstTier.get(city.countryCode);
  });
}
