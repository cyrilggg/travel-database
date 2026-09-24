const types = new Set(["prefecture", "county-city", "county", "district", "local-center", "other"]);

// Fail the build rather than silently rendering every newly imported level grey.
export function validateCityLevelPolicies(cities, policies) {
  for (const city of cities) {
    const policy = Object.hasOwn(policies, city.cityLevel) ? policies[city.cityLevel] : undefined;
    if (!policy || !types.has(policy.type) || typeof policy.label !== "string" || !policy.label.trim() ||
        typeof policy.reviewRequired !== "boolean" ||
        (policy.reviewRequired ? policy.minZoom !== null :
          ![0, 7, 9, 10].includes(policy.minZoom))) {
      throw new Error(`${city.id}: 行政类型 ${city.cityLevel} 缺少有效显示与核验规则；请更新 data/city-level-policy.json`);
    }
  }
}
