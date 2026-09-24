import type { MapCity } from "../generated/publicGuides";
import policies from "../../data/city-level-policy.json";

// Shared display groups are not equivalent legal ranks across countries.
export type AdministrativeType =
  | "prefecture" | "county-city" | "county" | "district" | "local-center" | "other";
export type CityLevelPolicy = {
  type: AdministrativeType;
  label: string;
  minZoom: number | null;
  reviewRequired: boolean;
};
type ClassifiedCity = Pick<MapCity, "city" | "cityLevel"> & Partial<Pick<MapCity, "countryCode">>;
const registry = policies as Record<string, CityLevelPolicy>;
const unknownPolicy: CityLevelPolicy = {
  type: "other", label: "类型待核验", minZoom: null, reviewRequired: true,
};
export const ADMINISTRATIVE_TYPE_INFO: Record<AdministrativeType, { label: string; color: string }> = {
  prefecture: { label: "主要城市及区域中心", color: "#d55e00" },
  "county-city": { label: "一般城市", color: "#0072b2" },
  county: { label: "县", color: "#cc79a7" },
  district: { label: "区", color: "#5e3c99" },
  "local-center": { label: "地方行政中心", color: "#648780" },
  other: { label: "其他目的地", color: "#8f949b" },
};
export const ADMINISTRATIVE_TYPE_LEGEND = Object.entries(ADMINISTRATIVE_TYPE_INFO)
  .map(([type, info]) => ({ type: type as AdministrativeType, ...info }));

export function cityLevelPolicyOf(city: ClassifiedCity): CityLevelPolicy {
  // Only legacy Chinese guide destinations use name-based classification.
  if (city.cityLevel === "guide_destination" && city.countryCode === "CN") {
    if (city.city.endsWith("市")) return { type: "prefecture", label: "城市攻略", minZoom: 0, reviewRequired: false };
    if (city.city.endsWith("县")) return { type: "county", label: "县", minZoom: 9, reviewRequired: false };
    if (city.city.endsWith("区")) return { type: "district", label: "区", minZoom: 9, reviewRequired: false };
  }
  return Object.hasOwn(registry, city.cityLevel) ? registry[city.cityLevel] : unknownPolicy;
}
export const administrativeTypeOf = (city: ClassifiedCity): AdministrativeType => cityLevelPolicyOf(city).type;
export const administrativeTypeInfoOf = (city: ClassifiedCity) => {
  const policy = cityLevelPolicyOf(city);
  return { ...ADMINISTRATIVE_TYPE_INFO[policy.type], label: policy.label };
};
