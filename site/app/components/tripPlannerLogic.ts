import type { GuideMapPlace, GuideMapRoute } from "./guideMapData";

export type TripPlanDay = {
  route: GuideMapRoute;
  places: GuideMapPlace[];
  distanceKilometers: number;
};

type Coordinate = { longitude: number; latitude: number };

export function distanceInKilometers(from: Coordinate, to: Coordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function centroid(places: GuideMapPlace[]) {
  return {
    longitude: places.reduce((sum, place) => sum + place.longitude, 0) / places.length,
    latitude: places.reduce((sum, place) => sum + place.latitude, 0) / places.length,
  };
}

function nearestNeighborOrder(places: GuideMapPlace[], start: Coordinate) {
  const remaining = [...places];
  const ordered: GuideMapPlace[] = [];
  let cursor = start;
  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    remaining.forEach((place, index) => {
      const distance = distanceInKilometers(cursor, place);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

function chooseSeeds(places: GuideMapPlace[], count: number, center: Coordinate) {
  const first = [...places].sort(
    (a, b) => distanceInKilometers(a, center) - distanceInKilometers(b, center),
  )[0];
  const seeds = [first];
  while (seeds.length < count) {
    const next = places
      .filter((place) => !seeds.includes(place))
      .map((place) => ({
        place,
        distance: Math.min(...seeds.map((seed) => distanceInKilometers(place, seed))),
      }))
      .sort((a, b) => b.distance - a.distance)[0]?.place;
    if (!next) break;
    seeds.push(next);
  }
  return seeds;
}

function clusterByDistance(places: GuideMapPlace[], dayCount: number, center: Coordinate) {
  const seeds = chooseSeeds(places, dayCount, center);
  const groups = seeds.map((seed) => [seed]);
  const baseSize = Math.floor(places.length / dayCount);
  const remainder = places.length % dayCount;
  const capacities = groups.map((_, index) => baseSize + (index < remainder ? 1 : 0));
  const remaining = places
    .filter((place) => !seeds.includes(place))
    .sort((a, b) => {
      const aDistance = Math.min(...seeds.map((seed) => distanceInKilometers(a, seed)));
      const bDistance = Math.min(...seeds.map((seed) => distanceInKilometers(b, seed)));
      return bDistance - aDistance;
    });

  for (const place of remaining) {
    const target = groups
      .map((group, index) => ({
        index,
        available: group.length < capacities[index],
        distance: distanceInKilometers(place, centroid(group)),
      }))
      .filter((candidate) => candidate.available)
      .sort((a, b) => a.distance - b.distance)[0];
    groups[target?.index ?? 0].push(place);
  }
  return groups;
}

export function buildTripPlan(
  allPlaces: readonly GuideMapPlace[],
  selectedIds: readonly string[],
  requestedDays: number,
  center: Coordinate,
): TripPlanDay[] {
  const selected = selectedIds.flatMap((id) => {
    const place = allPlaces.find((candidate) => candidate.id === id && candidate.kind === "attraction");
    return place ? [place] : [];
  });
  if (selected.length === 0) return [];
  const dayCount = Math.max(1, Math.min(5, requestedDays, selected.length));
  return clusterByDistance(selected, dayCount, center)
    .map((group) => nearestNeighborOrder(group, center))
    .sort((a, b) => distanceInKilometers(a[0], center) - distanceInKilometers(b[0], center))
    .map((places, index) => {
      const distanceKilometers = places.slice(1).reduce(
        (sum, place, placeIndex) => sum + distanceInKilometers(places[placeIndex], place),
        0,
      );
      return {
        route: {
          id: `planner-day-${index + 1}`,
          title: `第 ${index + 1} 天`,
          itemTitle: "规划行程",
          stops: places.map((place) => ({ placeId: place.id })),
        },
        places,
        distanceKilometers,
      };
    });
}
