import type { MapCity } from "../generated/publicGuides";

type Coordinate = { longitude: number; latitude: number };

export type JourneyStop = {
  city: MapCity;
  days: number;
  dayStart: number;
  dayEnd: number;
  distanceFromPrevious: number;
};

export type JourneyPlan = {
  stops: JourneyStop[];
  totalDays: number;
  totalDistance: number;
};

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

export function buildJourneyPlan(
  cities: readonly MapCity[],
  selectedCityIds: readonly string[],
  daysByCityId: Readonly<Record<string, number>>,
  startCityId?: string,
): JourneyPlan {
  const selected = selectedCityIds.flatMap((id) => {
    const city = cities.find((candidate) => candidate.id === id);
    return city ? [city] : [];
  });
  if (selected.length === 0) return { stops: [], totalDays: 0, totalDistance: 0 };

  const start = selected.find((city) => city.id === startCityId) ?? selected[0];
  const ordered = [start];
  const remaining = selected.filter((city) => city.id !== start.id);
  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    remaining.forEach((city, index) => {
      const distance = distanceInKilometers(previous.coordinates, city.coordinates);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  let elapsedDays = 0;
  let totalDistance = 0;
  const stops = ordered.map((city, index) => {
    const days = Math.max(1, Math.min(14, Math.round(daysByCityId[city.id] ?? 1)));
    const distanceFromPrevious = index === 0
      ? 0
      : distanceInKilometers(ordered[index - 1].coordinates, city.coordinates);
    const stop = {
      city,
      days,
      dayStart: elapsedDays + 1,
      dayEnd: elapsedDays + days,
      distanceFromPrevious,
    };
    elapsedDays += days;
    totalDistance += distanceFromPrevious;
    return stop;
  });

  return { stops, totalDays: elapsedDays, totalDistance };
}
