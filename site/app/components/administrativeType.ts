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
  prefecture: { label: "主要城市", color: "#d55e00" },
  "county-city": { label: "一般城市", color: "#0072b2" },
  county: { label: "县", color: "#cc79a7" },
  district: { label: "区", color: "#5e3c99" },
  other: { label: "其他入口", color: "#8f949b" },
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
    city.cityLevel === "taiwan_provincial_city" ||
    city.cityLevel === "south_korea_special_city" ||
    city.cityLevel === "south_korea_metropolitan_city" ||
    city.cityLevel === "south_korea_special_self_governing_city" ||
    city.cityLevel === "south_korea_integrated_special_city" ||
    city.cityLevel === "north_korea_directly_governed_city" ||
    city.cityLevel === "north_korea_special_city" ||
    city.cityLevel === "japan_special_ward_area" ||
    city.cityLevel === "mongolia_capital_city" ||
    city.cityLevel === "mongolia_national_city" ||
    city.cityLevel === "philippines_highly_urbanized_city" ||
    city.cityLevel === "philippines_independent_component_city" ||
    city.cityLevel === "vietnam_centrally_governed_city" ||
    city.cityLevel === "thailand_special_local_government" ||
    city.cityLevel === "malaysia_federal_capital_city_hall" ||
    city.cityLevel === "singapore_city_state_capital" ||
    city.cityLevel === "brunei_capital_municipal_area" ||
    city.cityLevel === "cambodia_capital_municipality" ||
    city.cityLevel === "laos_capital_prefecture" ||
    city.cityLevel === "myanmar_capital_city_development_area" ||
    city.cityLevel === "timor_leste_capital_city" ||
    city.cityLevel === "maldives_capital_city_council" ||
    city.cityLevel === "bhutan_capital_thromde" ||
    city.cityLevel === "sri_lanka_capital_municipal_council" ||
    city.cityLevel === "nepal_capital_metropolitan_city" ||
    city.cityLevel === "nepal_metropolitan_city" ||
    city.cityLevel === "nepal_sub_metropolitan_city"
  ) {
    return "prefecture";
  }

  if (
    city.cityLevel === "county_level_city" ||
    city.cityLevel === "taiwan_county_administered_city" ||
    city.cityLevel === "south_korea_municipal_city" ||
    city.cityLevel === "south_korea_administrative_city" ||
    city.cityLevel === "north_korea_provincial_city" ||
    city.cityLevel === "japan_municipal_city" ||
    city.cityLevel === "mongolia_aimag_city" ||
    city.cityLevel === "philippines_component_city" ||
    city.cityLevel === "indonesia_autonomous_city" ||
    city.cityLevel === "indonesia_administrative_city" ||
    city.cityLevel === "thailand_city_municipality" ||
    city.cityLevel === "malaysia_city_local_authority" ||
    city.cityLevel === "brunei_municipal_area" ||
    city.cityLevel === "cambodia_municipality" ||
    city.cityLevel === "laos_city" ||
    city.cityLevel === "myanmar_city_development_area" ||
    city.cityLevel === "maldives_city_council" ||
    city.cityLevel === "bhutan_autonomous_thromde" ||
    city.cityLevel === "sri_lanka_municipal_council" ||
    city.cityLevel === "nepal_municipality"
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
