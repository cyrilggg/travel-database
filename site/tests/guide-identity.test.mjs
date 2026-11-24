import assert from "node:assert/strict";
import test from "node:test";
import { resolveGuideIdentity } from "../scripts/guide-identity.mjs";

const coordinates = { longitude: 110.34, latitude: 1.59 };
const inventory = {
  coordinatesByGeonamesId: new Map([["1735161", coordinates]]),
  centersWithoutGeonames: new Map([
    ["malaysia-1301", { countryCode: "MY", coordinates }],
  ]),
};
const municipalGuide = { geonames_id: null, map_id: "malaysia-1301", country_code: "MY" };

test("a guide can explicitly use a registered municipal identity without a GeoNames ID", () => {
  assert.deepEqual(resolveGuideIdentity(municipalGuide, inventory, "guide.md"), {
    id: "malaysia-1301", geonamesId: null, coordinates,
  });
});

test("a populated-place guide keeps its original identity", () => {
  const data = { geonames_id: 1735161, country_code: "MY" };
  assert.deepEqual(resolveGuideIdentity(data, inventory, "guide.md"), {
    id: "my-1735161", geonamesId: "1735161", coordinates,
  });
});

test("absent, conflicting, unknown and cross-country references fail", () => {
  for (const change of [
    { map_id: undefined }, { map_id: "malaysia-missing" }, { country_code: "TH" },
    { geonames_id: 1735161 }, { geonames_id: undefined }, { geonames_id: "" },
  ]) {
    assert.throws(() => resolveGuideIdentity({ ...municipalGuide, ...change }, inventory, "guide.md"));
  }
});
