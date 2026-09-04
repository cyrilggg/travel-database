import type { MapCity } from "../generated/publicGuides";

export type AdministrativeType =
  | "prefecture"
  | "county-city"
  | "county"
  | "district"
  | "other";

export const ADMINISTRATIVE_TYPE_INFO: Record<
  AdministrativeType,
  { label: string; color: string }
> = {
  prefecture: { label: "地级市及以上", color: "#b64a35" },
  "county-city": { label: "县级市", color: "#21706b" },
  county: { label: "县", color: "#ae741d" },
  district: { label: "区", color: "#5964a8" },
  other: { label: "镇及其他", color: "#66746f" },
};

export const ADMINISTRATIVE_TYPE_LEGEND = (
  ["prefecture", "county-city", "county", "district", "other"] as const
).map((type) => ({ type, ...ADMINISTRATIVE_TYPE_INFO[type] }));

export const administrativeTypeOf = (
  city: Pick<MapCity, "city" | "cityLevel">,
): AdministrativeType => {
  if (
    city.cityLevel === "direct_municipality" ||
    city.cityLevel === "prefecture_level_city" ||
    city.cityLevel === "taiwan_municipality" ||
    city.cityLevel === "taiwan_provincial_city"
  ) {
    return "prefecture";
  }

  if (
    city.cityLevel === "county_level_city" ||
    city.cityLevel === "taiwan_county_administered_city"
  ) {
    return "county-city";
  }

  if (city.city.endsWith("市")) return "prefecture";
  if (city.city.endsWith("县")) return "county";
  if (city.city.endsWith("区")) return "district";
  return "other";
};

export const administrativeTypeInfoOf = (
  city: Pick<MapCity, "city" | "cityLevel">,
) => ADMINISTRATIVE_TYPE_INFO[administrativeTypeOf(city)];
