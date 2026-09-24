import assert from "node:assert/strict";
import test from "node:test";
import policies from "../data/city-level-policy.json";
import { mapCities, type MapCity } from "../app/generated/publicGuides";
import { administrativeTypeOf, cityLevelPolicyOf } from "../app/components/administrativeType";
import { visibleMapCities, isDefaultMapDestination, cityZoomBand, CITY_CLUSTER_OPTIONS } from "../app/components/cityMapVisibility";
import { validateCityLevelPolicies } from "../scripts/city-level-policy.mjs";
import { findMapCity, citySearchLabel } from "../app/components/citySearch";

test("all imported levels require deliberate policies, unknown levels fail the build", () => {
  validateCityLevelPolicies(mapCities, policies);
  assert.throws(() => validateCityLevelPolicies([{id: "new-city", cityLevel: "unmapped_city"}], policies), /unmapped_city/);
  assert.throws(() => validateCityLevelPolicies([{id: "new-city", cityLevel: "toString"}], policies), /toString/);
  assert.throws(() => validateCityLevelPolicies([{id: "new-city", cityLevel: "bad"}], {
    bad: { type: "other", label: "Unknown", minZoom: 0, reviewRequired: true },
  }), /bad/);
});

test("Turkey: 81 overview anchors; 779 district centers on zoom; 111 candidates stay out", () => {
  // Check the inventory policy independently of newly authored guide exemptions.
  const cities = mapCities.filter(city => city.id.startsWith("turkey-"))
    .map(city => ({...city, coverage: 0 as const, guideId: undefined}));
  assert.equal(cities.length, 971);
  assert.equal(visibleMapCities(cities, 6.9).length, 81);
  assert.equal(visibleMapCities(cities, 8.9).length, 81);
  assert.equal(visibleMapCities(cities, 9).length, 860);
  assert.equal(visibleMapCities(cities, 16).length, 860);
  assert.equal(cities.filter(city => !isDefaultMapDestination(city)).length, 111);
  const capital = cities.find(city => city.city === "安卡拉")!;
  const district = cities.find(city => city.cityLevel === "turkey_district_center")!;
  assert.equal(administrativeTypeOf(capital), "prefecture");
  assert.equal(administrativeTypeOf(district), "local-center");
  assert.match(cityLevelPolicyOf(district).label, /ilçe/);
});

test("zoom transitions are monotonic; no reviewed country disappears; guides remain reachable", () => {
  let previous = new Set<string>();
  for (const zoom of [0, 6.99, 7, 8.99, 9, 9.99, 10, 12, 13, 16]) {
    const visible = visibleMapCities(mapCities, zoom);
    const ids = new Set(visible.map(city => city.id));
    for (const id of previous) assert.ok(ids.has(id), `${id} lost at ${zoom}`);
    for (const city of mapCities.filter(city => city.coverage === 1)) assert.ok(ids.has(city.id));
    for (const country of new Set(mapCities.filter(isDefaultMapDestination).map(city => city.countryCode))) {
      assert.ok(visible.some(city => city.countryCode === country), `${country} vanished`);
    }
    assert.ok(visible.every(isDefaultMapDestination));
    previous = ids;
  }
  assert.equal(visibleMapCities(mapCities, 16).length, mapCities.filter(isDefaultMapDestination).length);
  assert.ok(CITY_CLUSTER_OPTIONS.clusterMaxZoom >= 12);
  assert.ok(CITY_CLUSTER_OPTIONS.clusterRadius >= 60);
  for (const zoom of [0, 6.99, 7, 8.99, 9, 9.99, 10, 16]) {
    assert.deepEqual(visibleMapCities(mapCities, zoom), visibleMapCities(mapCities, cityZoomBand(zoom)));
  }
});

test("Chinese guide classification stays local; translated foreign names do not imply Chinese ranks", () => {
  const guide = {city: "示例区", cityLevel: "guide_destination", countryCode: "CN"};
  assert.equal(administrativeTypeOf(guide), "district");
  assert.equal(administrativeTypeOf({...guide, countryCode: "TR"}), "other");
  assert.equal(administrativeTypeOf({...guide, cityLevel: "unknown", city: "示例市"}), "other");
});

test("candidate IDs and coordinates remain in search inventory, future guides are exempt", () => {
  const candidate = mapCities.find(city => city.countryCode === "TR" && !isDefaultMapDestination(city))!;
  assert.ok(candidate.id.startsWith("turkey-"));
  assert.ok(Number.isFinite(candidate.coordinates.longitude));
  assert.ok(Number.isFinite(candidate.coordinates.latitude));
  assert.equal(findMapCity(mapCities, citySearchLabel(candidate))?.id, candidate.id);
  const covered = {...candidate, coverage: 1, guideId: "future-guide"} as MapCity;
  assert.ok(isDefaultMapDestination(covered));
  assert.deepEqual(visibleMapCities([covered], 0), [covered]);
});

test("exact city names win over earlier districts whose province has the same name", () => {
  assert.equal(findMapCity(mapCities, "伊斯坦布尔")?.id, "turkey-745044");
  assert.equal(findMapCity(mapCities, "安卡拉")?.cityLevel, "turkey_country_capital");
  assert.equal(findMapCity(mapCities, " "), undefined);
});
