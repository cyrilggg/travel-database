import { guideMapsData } from "../generated/guideMaps";
import type { GuideBrowseItem, GuideBrowseKey } from "../generated/publicGuides";

export type GuideMapMode = "overview" | "attractions" | "itinerary" | "food";

export type GuideMapPlace = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  kind: "attraction" | "food-area";
  itemTitles: string[];
  priority?: "A" | "B" | "C" | "route";
  featured?: boolean;
};

export type GuideMapRouteStop = {
  placeId: string;
  label?: string;
};

export type GuideMapRoute = {
  id: string;
  title: string;
  itemTitle: string;
  stops: GuideMapRouteStop[];
};

export type GuideMapContent = {
  guideId: string;
  places: GuideMapPlace[];
  routes: GuideMapRoute[];
};

export type GuideMapSelection = {
  mode: GuideMapMode;
  itemId?: string;
  selectedItemIds?: string[];
  itemTitle?: string;
  routeId?: string;
};

const guideMaps = new Map<string, GuideMapContent>(
  guideMapsData.map((guideMap) => [guideMap.guideId, guideMap]),
);

export function getGuideMapContent(guideId: string) {
  return guideMaps.get(guideId);
}

export function getGuideMapItemId(
  content: GuideMapContent,
  key: GuideBrowseKey,
  item: Pick<GuideBrowseItem, "title">,
) {
  if (key === "itinerary") {
    return content.routes.find((route) => route.itemTitle === item.title)?.id;
  }
  if (key === "attractions" || key === "food") {
    const kind = key === "attractions" ? "attraction" : "food-area";
    return content.places.find(
      (place) => place.kind === kind && place.itemTitles.includes(item.title),
    )?.id;
  }
  return undefined;
}

export function mapModeForSection(key: GuideBrowseKey): GuideMapMode | undefined {
  if (key === "attractions" || key === "itinerary" || key === "food") return key;
  if (key === "overview" || key === "regions") return "overview";
  return undefined;
}
