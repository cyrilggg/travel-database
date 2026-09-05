"use client";

import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapMouseEvent,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { MapCity } from "../generated/publicGuides";
import type {
  GuideMapContent,
  GuideMapSelection,
} from "./guideMapData";
import {
  ADMINISTRATIVE_TYPE_INFO,
  ADMINISTRATIVE_TYPE_LEGEND,
  administrativeTypeInfoOf,
  administrativeTypeOf,
} from "./administrativeType";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/bright";
const TERRAIN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
const TERRAIN_SOURCE_ID = "travel-terrain";
const HILLSHADE_LAYER_ID = "travel-hillshade";
const ROUTE_SOURCE_ID = "travel-itinerary-route";
const ROUTE_GLOW_LAYER_ID = "travel-route-glow";
const ROUTE_LAYER_ID = "travel-route";
const GUIDE_CONTENT_SOURCE_ID = "travel-guide-content";
const GUIDE_FOOD_AREA_LAYER_ID = "travel-guide-food-area";
const GUIDE_CONTENT_POINT_LAYER_ID = "travel-guide-content-point";
const GUIDE_CONTENT_HIT_LAYER_ID = "travel-guide-content-hit";
const GUIDE_CONTENT_ACTIVE_LAYER_ID = "travel-guide-content-active";
const GUIDE_CONTENT_LABEL_LAYER_ID = "travel-guide-content-label";
const ROUTE_STOP_LAYER_ID = "travel-route-stop";
const ROUTE_STOP_LABEL_LAYER_ID = "travel-route-stop-label";
const GUIDE_SOURCE_ID = "travel-guide-points";
const CLUSTER_LAYER_ID = "travel-guide-clusters";
const CLUSTER_PARTIAL_RING_LAYER_ID = "travel-guide-cluster-partial-ring";
const CLUSTER_HIT_LAYER_ID = "travel-guide-cluster-hit-area";
const CLUSTER_COUNT_LAYER_ID = "travel-guide-cluster-count";
const GUIDE_POINT_LAYER_ID = "travel-guide-point";
const GUIDE_HIT_LAYER_ID = "travel-guide-hit-area";
const ACTIVE_POINT_LAYER_ID = "travel-guide-active";
const GUIDE_LABEL_LAYER_ID = "travel-guide-label";
const EXPLORE_SOURCE_ID = "travel-explore-point";
const EXPLORE_HALO_LAYER_ID = "travel-explore-halo";
const EXPLORE_POINT_LAYER_ID = "travel-explore-point-core";

if (typeof document !== "undefined") {
  setWorkerUrl(
    new URL("maplibre-v3/maplibre-gl-worker.mjs", document.baseURI).toString(),
  );
}

const CHINA_BOUNDS: [[number, number], [number, number]] = [
  [73.2, 18.1],
  [134.8, 53.6],
];

type TerrainMapProps = {
  cities: MapCity[];
  activeCityId?: string;
  highlightedCityIds?: string[];
  preserveViewport?: boolean;
  guideMap?: GuideMapContent;
  guideMapSelection: GuideMapSelection;
  panelLayout: "collapsed" | "docked" | "expanded";
  explorePoint?: { longitude: number; latitude: number };
  onSelectCity: (city: MapCity) => void;
  onSelectGuideItem: (itemId: string) => void;
  onExploreNear: (point: { longitude: number; latitude: number }) => void;
  onViewportCitiesChange: (ids: string[]) => void;
  resetSignal: number;
};

type PanelLayout = TerrainMapProps["panelLayout"];
type ExplorePoint = NonNullable<TerrainMapProps["explorePoint"]>;
type MapContainer = HTMLDivElement | null | undefined;

const MOBILE_MAP_QUERY = "(max-width: 840px), (orientation: landscape) and (max-height: 520px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PANEL_HISTORY_KEY = "__travelMapPanel";

const shortCityName = (name: string) => name.replace(/[市区]$/, "");

const administrativeColorExpression = [
  "match",
  ["get", "administrativeType"],
  "prefecture",
  ADMINISTRATIVE_TYPE_INFO.prefecture.color,
  "county-city",
  ADMINISTRATIVE_TYPE_INFO["county-city"].color,
  "county",
  ADMINISTRATIVE_TYPE_INFO.county.color,
  "district",
  ADMINISTRATIVE_TYPE_INFO.district.color,
  ADMINISTRATIVE_TYPE_INFO.other.color,
] as const;

const administrativeRadiusExpression = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  [
    "match",
    ["get", "administrativeType"],
    "prefecture", 6.5,
    "county-city", 5.4,
    "county", 4.7,
    "district", 4.1,
    3.7,
  ],
  7,
  [
    "match",
    ["get", "administrativeType"],
    "prefecture", 8.5,
    "county-city", 7.2,
    "county", 6.2,
    "district", 5.4,
    4.8,
  ],
  10,
  [
    "match",
    ["get", "administrativeType"],
    "prefecture", 10.5,
    "county-city", 9,
    "county", 7.8,
    "district", 6.8,
    6,
  ],
] as const;

const isMobileMapExperience = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_MAP_QUERY).matches;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const mapPadding = (layout: PanelLayout, container?: MapContainer) => {
  if (typeof window === "undefined") {
    return {
      top: 86,
      right: layout === "collapsed" ? 42 : layout === "expanded" ? 790 : 530,
      bottom: 42,
      left: 42,
    };
  }

  if (isMobileMapExperience()) {
    const visualViewport = window.visualViewport;
    const containerRect = container?.getBoundingClientRect();
    const viewportWidth = Math.max(
      1,
      Math.min(containerRect?.width ?? window.innerWidth, visualViewport?.width ?? window.innerWidth),
    );
    const viewportHeight = Math.max(
      1,
      Math.min(
        containerRect?.height ?? window.innerHeight,
        visualViewport?.height ?? window.innerHeight,
      ),
    );
    const landscape = viewportWidth > viewportHeight;
    const top = landscape ? 64 : 116;
    const minimumMapHeight = landscape ? 96 : 160;
    const app = container?.closest<HTMLElement>(".travel-app");
    const panel = app?.querySelector<HTMLElement>(".panel-dock");
    const panelRect = panel?.getBoundingClientRect();
    const visualBottom = (containerRect?.top ?? 0) + viewportHeight;
    const panelOverlap =
      layout === "docked" && panelRect && !app?.classList.contains("is-mobile-keyboard-open")
        ? Math.max(0, visualBottom - panelRect.top)
        : 0;
    const fallbackPanelHeight = viewportHeight * (landscape ? 0.44 : 0.46);
    const desiredBottom =
      layout === "docked" ? Math.max(panelOverlap, fallbackPanelHeight) + 14 : 24;
    const bottom = Math.min(
      desiredBottom,
      Math.max(20, viewportHeight - top - minimumMapHeight),
    );

    return {
      top,
      right: landscape ? 16 : 20,
      bottom,
      left: landscape ? 16 : 20,
    };
  }

  const dockedPanelWidth = Math.min(500, Math.max(400, window.innerWidth * 0.31));
  const expandedPanelWidth = Math.min(760, window.innerWidth - 32);

  return {
    top: 86,
    right:
      layout === "collapsed"
        ? 42
        : layout === "expanded"
          ? Math.min(790, expandedPanelWidth + 30)
          : dockedPanelWidth + 30,
    bottom: 42,
    left: 42,
  };
};

const guideFeatureCollection = (cities: MapCity[]) => ({
  type: "FeatureCollection" as const,
  features: cities.map((city) => ({
    type: "Feature" as const,
    properties: {
      id: city.id,
      guideId: city.guideId ?? "",
      city: shortCityName(city.city),
      adminArea: city.adminArea,
      administrativeType: administrativeTypeOf(city),
      administrativeTypeLabel: administrativeTypeInfoOf(city).label,
      coverage: city.coverage,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [city.coordinates.longitude, city.coordinates.latitude],
    },
  })),
});

const exploreFeatureCollection = (point?: ExplorePoint) => ({
  type: "FeatureCollection" as const,
  features: point
    ? [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Point" as const,
            coordinates: [point.longitude, point.latitude],
          },
        },
      ]
    : [],
});

const emptyFeatureCollection = () => ({
  type: "FeatureCollection" as const,
  features: [],
});

const selectedRoute = (content: GuideMapContent, selection: GuideMapSelection) =>
  content.routes.find((route) => route.id === selection.routeId) ?? content.routes[0];

const visibleGuidePlaces = (content: GuideMapContent, selection: GuideMapSelection) => {
  if (selection.mode === "food") {
    return content.places.filter((place) => place.kind === "food-area");
  }
  if (selection.mode === "itinerary") {
    const route = selectedRoute(content, selection);
    return (route?.stops ?? []).flatMap((stop, index) => {
      const place = content.places.find((candidate) => candidate.id === stop.placeId);
      return place ? [{ ...place, routeOrder: index + 1, routeLabel: stop.label }] : [];
    });
  }
  if (selection.mode === "attractions") {
    return content.places.filter((place) => place.kind === "attraction");
  }
  return content.places.filter(
    (place) => place.kind === "attraction" && place.featured,
  );
};

const guideContentFeatureCollection = (
  content?: GuideMapContent,
  selection: GuideMapSelection = { mode: "overview" },
) => ({
  type: "FeatureCollection" as const,
  features: content
    ? visibleGuidePlaces(content, selection).map((place) => ({
        type: "Feature" as const,
        properties: {
          id: place.id,
          name:
            "routeLabel" in place && typeof place.routeLabel === "string"
              ? place.routeLabel
              : place.name,
          kind: selection.mode === "itinerary" ? "route-stop" : place.kind,
          priority: place.priority ?? "",
          order: "routeOrder" in place ? place.routeOrder : 0,
          active: place.id === selection.itemId ? 1 : 0,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [place.longitude, place.latitude],
        },
      }))
    : [],
});

const routeFeatureCollection = (
  content?: GuideMapContent,
  selection: GuideMapSelection = { mode: "overview" },
) => {
  if (!content || selection.mode !== "itinerary") return emptyFeatureCollection();
  const route = selectedRoute(content, selection);
  const coordinates = (route?.stops ?? []).flatMap((stop) => {
    const place = content.places.find((candidate) => candidate.id === stop.placeId);
    return place ? [[place.longitude, place.latitude]] : [];
  });
  if (coordinates.length < 2) return emptyFeatureCollection();
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { id: route?.id ?? "" },
        geometry: { type: "LineString" as const, coordinates },
      },
    ],
  };
};

const addTerrainLayers = (map: MapLibreMap) => {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      url: TERRAIN_TILEJSON,
      tileSize: 512,
      encoding: "terrarium",
      maxzoom: 12,
    });
  }

  const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: "hillshade",
        source: TERRAIN_SOURCE_ID,
        paint: {
          "hillshade-illumination-direction": 320,
          "hillshade-illumination-altitude": 42,
          "hillshade-shadow-color": "#405b52",
          "hillshade-highlight-color": "#f7f2e6",
          "hillshade-accent-color": "#6f7c66",
          "hillshade-exaggeration": 0.42,
        },
      },
      firstSymbolLayer,
    );
  }

};

export default function TerrainMap({
  cities,
  activeCityId,
  highlightedCityIds = [],
  preserveViewport = false,
  guideMap,
  guideMapSelection,
  panelLayout,
  explorePoint,
  onSelectCity,
  onSelectGuideItem,
  onExploreNear,
  onViewportCitiesChange,
  resetSignal,
}: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const citiesRef = useRef(cities);
  const onSelectCityRef = useRef(onSelectCity);
  const onSelectGuideItemRef = useRef(onSelectGuideItem);
  const onExploreNearRef = useRef(onExploreNear);
  const onViewportCitiesChangeRef = useRef(onViewportCitiesChange);
  const guideMapRef = useRef(guideMap);
  const guideMapSelectionRef = useRef(guideMapSelection);
  const panelLayoutRef = useRef(panelLayout);
  const appliedPanelLayoutRef = useRef<PanelLayout | null>(null);
  const explorePointRef = useRef(explorePoint);
  const terrainEnabledRef = useRef(false);
  const mobileExperienceRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const panelHistoryReadyRef = useRef(false);
  const panelHistoryTargetRef = useRef<PanelLayout | null>(null);
  const previousHistoryPanelRef = useRef(panelLayout);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [clusterEnabled, setClusterEnabled] = useState(true);
  const [mobileExperience, setMobileExperience] = useState(false);

  useEffect(() => {
    citiesRef.current = cities;
    onSelectCityRef.current = onSelectCity;
    onExploreNearRef.current = onExploreNear;
    onSelectGuideItemRef.current = onSelectGuideItem;
    onViewportCitiesChangeRef.current = onViewportCitiesChange;
  }, [cities, onExploreNear, onSelectCity, onSelectGuideItem, onViewportCitiesChange]);

  useEffect(() => {
    guideMapRef.current = guideMap;
    guideMapSelectionRef.current = guideMapSelection;
  }, [guideMap, guideMapSelection]);

  useEffect(() => {
    panelLayoutRef.current = panelLayout;
  }, [panelLayout]);

  useEffect(() => {
    explorePointRef.current = explorePoint;
  }, [explorePoint]);

  useEffect(() => {
    terrainEnabledRef.current = terrainEnabled;
  }, [terrainEnabled]);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_MAP_QUERY);
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const app = containerRef.current?.closest<HTMLElement>(".travel-app");
    const searchInput = document.querySelector<HTMLInputElement>("#city-search");
    const searchForm = searchInput?.closest<HTMLFormElement>("form");
    const visualViewport = window.visualViewport;
    const screenOrientation = window.screen.orientation;
    let visualFrame = 0;
    let baselineVisualHeight = visualViewport?.height ?? window.innerHeight;
    let orientationKey = screenOrientation?.type ?? "default";
    let appliedMobileMode: boolean | null = null;

    const syncInteractionMode = () => {
      const nextMobileMode = isMobileMapExperience();
      mobileExperienceRef.current = nextMobileMode;
      reducedMotionRef.current = prefersReducedMotion();
      setMobileExperience(nextMobileMode);

      const map = mapRef.current;
      if (!map || appliedMobileMode === nextMobileMode) return;
      appliedMobileMode = nextMobileMode;

      if (nextMobileMode) {
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();
        map.dragRotate.disable();
        map.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      } else {
        map.touchZoomRotate.enableRotation();
        map.touchPitch.enable();
        map.dragRotate.enable();
        map.setPixelRatio(window.devicePixelRatio || 1);
      }
    };

    const syncVisualViewport = () => {
      window.cancelAnimationFrame(visualFrame);
      visualFrame = window.requestAnimationFrame(() => {
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        const viewportTop = visualViewport?.offsetTop ?? 0;
        const nextOrientationKey = screenOrientation?.type ?? "default";
        if (nextOrientationKey !== orientationKey) {
          orientationKey = nextOrientationKey;
          baselineVisualHeight = viewportHeight;
        }

        const searchFocused = document.activeElement === searchInput;
        if (!searchFocused) baselineVisualHeight = Math.max(baselineVisualHeight, viewportHeight);
        const keyboardOpen =
          mobileExperienceRef.current &&
          searchFocused &&
          baselineVisualHeight - viewportHeight > 96;

        app?.style.setProperty("--android-visual-height", `${Math.round(viewportHeight)}px`);
        app?.style.setProperty("--android-visual-top", `${Math.round(viewportTop)}px`);
        app?.classList.toggle("is-mobile-keyboard-open", keyboardOpen);

        const map = mapRef.current;
        if (map) {
          map.resize();
          map.setPadding(mapPadding(panelLayoutRef.current, containerRef.current));
        }
      });
    };

    const handleEnvironmentChange = () => {
      syncInteractionMode();
      syncVisualViewport();
    };
    const handleSearchSubmit = () => {
      if (!mobileExperienceRef.current) return;
      searchInput?.blur();
      window.requestAnimationFrame(() => searchInput?.blur());
    };

    searchInput?.setAttribute("type", "search");
    searchInput?.setAttribute("inputmode", "search");
    searchInput?.setAttribute("enterkeyhint", "search");
    searchInput?.addEventListener("focus", syncVisualViewport);
    searchInput?.addEventListener("blur", syncVisualViewport);
    searchForm?.addEventListener("submit", handleSearchSubmit);
    mobileQuery.addEventListener("change", handleEnvironmentChange);
    motionQuery.addEventListener("change", handleEnvironmentChange);
    window.addEventListener("resize", handleEnvironmentChange);
    screenOrientation?.addEventListener("change", handleEnvironmentChange);
    visualViewport?.addEventListener("resize", syncVisualViewport);
    visualViewport?.addEventListener("scroll", syncVisualViewport);
    syncInteractionMode();
    syncVisualViewport();

    return () => {
      window.cancelAnimationFrame(visualFrame);
      searchInput?.removeEventListener("focus", syncVisualViewport);
      searchInput?.removeEventListener("blur", syncVisualViewport);
      searchForm?.removeEventListener("submit", handleSearchSubmit);
      mobileQuery.removeEventListener("change", handleEnvironmentChange);
      motionQuery.removeEventListener("change", handleEnvironmentChange);
      window.removeEventListener("resize", handleEnvironmentChange);
      screenOrientation?.removeEventListener("change", handleEnvironmentChange);
      visualViewport?.removeEventListener("resize", syncVisualViewport);
      visualViewport?.removeEventListener("scroll", syncVisualViewport);
      app?.classList.remove("is-mobile-keyboard-open");
      app?.style.removeProperty("--android-visual-height");
      app?.style.removeProperty("--android-visual-top");
    };
  }, []);

  useEffect(() => {
    if (!mobileExperience) {
      panelHistoryReadyRef.current = false;
      return;
    }

    const readHistoryLayout = (state: unknown): PanelLayout | null => {
      if (!state || typeof state !== "object") return null;
      const value = (state as Record<string, unknown>)[PANEL_HISTORY_KEY];
      return value === "collapsed" || value === "docked" || value === "expanded" ? value : null;
    };
    const withPanelLayout = (layout: PanelLayout) => ({
      ...(window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {}),
      [PANEL_HISTORY_KEY]: layout,
    });
    const clickPanelControl = (selector: string) => {
      document.querySelector<HTMLButtonElement>(selector)?.click();
    };
    const requestPanelLayout = (current: PanelLayout, next: PanelLayout) => {
      if (current === next) return;
      if (
        (current === "expanded" && next === "docked") ||
        (current === "docked" && next === "expanded")
      ) {
        clickPanelControl(".panel-dock .sheet-handle");
        return;
      }
      if (current === "docked" && next === "collapsed") {
        clickPanelControl(".panel-dock .panel-utility-bar button");
        return;
      }
      if (current === "collapsed" && next === "docked") {
        clickPanelControl(".panel-dock .panel-dock-toggle");
      }
    };

    const initialHistoryLayout = readHistoryLayout(window.history.state);
    if (!initialHistoryLayout) {
      window.history.replaceState(withPanelLayout("collapsed"), "", window.location.href);
      if (panelLayoutRef.current !== "collapsed") {
        window.history.pushState(
          withPanelLayout(panelLayoutRef.current),
          "",
          window.location.href,
        );
      }
    } else if (initialHistoryLayout !== panelLayoutRef.current) {
      window.history.pushState(withPanelLayout(panelLayoutRef.current), "", window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      const requestedLayout = readHistoryLayout(event.state);
      if (!requestedLayout || requestedLayout === panelLayoutRef.current) return;
      panelHistoryTargetRef.current = requestedLayout;
      requestPanelLayout(panelLayoutRef.current, requestedLayout);
    };

    previousHistoryPanelRef.current = panelLayoutRef.current;
    panelHistoryReadyRef.current = true;
    window.addEventListener("popstate", handlePopState);

    return () => {
      panelHistoryReadyRef.current = false;
      panelHistoryTargetRef.current = null;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [mobileExperience]);

  useEffect(() => {
    const previousLayout = previousHistoryPanelRef.current;
    previousHistoryPanelRef.current = panelLayout;
    if (
      !panelHistoryReadyRef.current ||
      !mobileExperience
    ) {
      return;
    }

    if (panelHistoryTargetRef.current === panelLayout) {
      panelHistoryTargetRef.current = null;
      return;
    }

    const historyLayout = (window.history.state as Record<string, unknown> | null)?.[
      PANEL_HISTORY_KEY
    ];
    if (historyLayout === panelLayout) return;

    const rank: Record<PanelLayout, number> = { collapsed: 0, docked: 1, expanded: 2 };
    if (rank[panelLayout] < rank[previousLayout]) {
      window.history.back();
      return;
    }

    window.history.pushState(
      {
        ...(window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {}),
        [PANEL_HISTORY_KEY]: panelLayout,
      },
      "",
      window.location.href,
    );
  }, [mobileExperience, panelLayout]);

  useEffect(() => {
    if (!mobileExperience) return;
    const sheetHandle = document.querySelector<HTMLButtonElement>(".panel-dock .sheet-handle");
    const collapsedToggle = document.querySelector<HTMLButtonElement>(
      ".panel-dock .panel-dock-toggle",
    );
    const handles = [sheetHandle, collapsedToggle].filter(
      (handle): handle is HTMLButtonElement => Boolean(handle),
    );
    let pointerId: number | null = null;
    let startY = 0;
    let suppressNextClick = false;
    let programmaticClick = false;

    const clickControl = (control: HTMLButtonElement | null) => {
      if (!control) return;
      programmaticClick = true;
      control.click();
      programmaticClick = false;
    };
    const requestPanelStep = (direction: "up" | "down") => {
      const current = panelLayoutRef.current;
      if (direction === "up") {
        if (current === "collapsed") clickControl(collapsedToggle);
        if (current === "docked") clickControl(sheetHandle);
        return;
      }
      if (current === "expanded") clickControl(sheetHandle);
      if (current === "docked") {
        clickControl(
          document.querySelector<HTMLButtonElement>(".panel-dock .panel-utility-bar button"),
        );
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (Math.abs(event.clientY - startY) > 8) event.preventDefault();
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const deltaY = event.clientY - startY;
      pointerId = null;
      if (Math.abs(deltaY) < 44) return;
      event.preventDefault();
      suppressNextClick = true;
      requestPanelStep(deltaY < 0 ? "up" : "down");
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) pointerId = null;
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (programmaticClick || !suppressNextClick) return;
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    handles.forEach((handle) => {
      handle.addEventListener("pointerdown", handlePointerDown);
      handle.addEventListener("pointermove", handlePointerMove);
      handle.addEventListener("pointerup", handlePointerEnd);
      handle.addEventListener("pointercancel", handlePointerCancel);
      handle.addEventListener("click", handleClickCapture, true);
    });

    return () => {
      handles.forEach((handle) => {
        handle.removeEventListener("pointerdown", handlePointerDown);
        handle.removeEventListener("pointermove", handlePointerMove);
        handle.removeEventListener("pointerup", handlePointerEnd);
        handle.removeEventListener("pointercancel", handlePointerCancel);
        handle.removeEventListener("click", handleClickCapture, true);
      });
    };
  }, [mobileExperience]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const mobileMode = isMobileMapExperience();
    const reduceMotion = prefersReducedMotion();
    mobileExperienceRef.current = mobileMode;
    reducedMotionRef.current = reduceMotion;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [104.4, 35.4],
      zoom: 3.2,
      minZoom: 1.8,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      maxPitch: 60,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: !mobileMode,
      touchPitch: !mobileMode,
      clickTolerance: mobileMode ? 6 : 3,
      fadeDuration: reduceMotion ? 0 : 180,
      reduceMotion,
      pixelRatio: mobileMode ? Math.min(window.devicePixelRatio || 1, 2) : undefined,
      maxTileCacheZoomLevels: mobileMode ? 3 : 5,
      cancelPendingTileRequestsWhileZooming: true,
    });

    mapRef.current = map;
    map.keyboard.disable();
    if (mobileMode) map.touchZoomRotate.disableRotation();
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://mapterhorn.com/" target="_blank" rel="noreferrer">Terrain © Mapterhorn</a>',
      }),
      "bottom-left",
    );
    const attributionElement = containerRef.current.querySelector<HTMLElement>(
      ".maplibregl-ctrl-attrib",
    );
    if (attributionElement) {
      attributionElement.classList.remove("maplibregl-compact-show");
      attributionElement.setAttribute("open", "");
    }
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "terrain-guide-popup",
    });
    let blankClickTimer: number | undefined;
    const pressedArrows = new Set<string>();
    let panFrame = 0;
    let lastPanTime = 0;
    const runKeyboardPan = (time: number) => {
      const horizontal = Number(pressedArrows.has("ArrowRight")) - Number(pressedArrows.has("ArrowLeft"));
      const vertical = Number(pressedArrows.has("ArrowDown")) - Number(pressedArrows.has("ArrowUp"));
      if (horizontal || vertical) {
        const elapsed = lastPanTime ? Math.min(32, time - lastPanTime) : 16;
        const speed = 0.34 * elapsed;
        map.panBy([horizontal * speed, vertical * speed], { duration: 0 });
        lastPanTime = time;
        panFrame = window.requestAnimationFrame(runKeyboardPan);
      } else {
        lastPanTime = 0;
        panFrame = 0;
      }
    };
    const handleArrowDown = (event: KeyboardEvent) => {
      if (!event.key.startsWith("Arrow")) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))) return;
      event.preventDefault();
      pressedArrows.add(event.key);
      if (!panFrame) panFrame = window.requestAnimationFrame(runKeyboardPan);
    };
    const handleArrowUp = (event: KeyboardEvent) => {
      if (!event.key.startsWith("Arrow")) return;
      pressedArrows.delete(event.key);
    };
    const clearArrows = () => pressedArrows.clear();
    window.addEventListener("keydown", handleArrowDown);
    window.addEventListener("keyup", handleArrowUp);
    window.addEventListener("blur", clearArrows);

    const publishViewportGuides = () => {
      if (!map.getSource(GUIDE_SOURCE_ID)) return;
      const padding = mapPadding(panelLayoutRef.current, containerRef.current);
      const canvas = map.getCanvas();
      const visibleGuideIds = citiesRef.current
        .filter(({ coordinates }) => {
          const projected = map.project([coordinates.longitude, coordinates.latitude]);
          return (
            projected.x >= padding.left &&
            projected.x <= canvas.clientWidth - padding.right &&
            projected.y >= padding.top &&
            projected.y <= canvas.clientHeight - padding.bottom
          );
        })
        .map(({ id }) => id);
      onViewportCitiesChangeRef.current(visibleGuideIds);
    };

    const handleBlankMapClick = (event: MapMouseEvent) => {
      const interactiveLayers = [
        CLUSTER_LAYER_ID,
        CLUSTER_PARTIAL_RING_LAYER_ID,
        CLUSTER_HIT_LAYER_ID,
        CLUSTER_COUNT_LAYER_ID,
        GUIDE_POINT_LAYER_ID,
        GUIDE_HIT_LAYER_ID,
        ACTIVE_POINT_LAYER_ID,
        GUIDE_LABEL_LAYER_ID,
        GUIDE_CONTENT_HIT_LAYER_ID,
        GUIDE_CONTENT_LABEL_LAYER_ID,
        ROUTE_STOP_LAYER_ID,
        ROUTE_STOP_LABEL_LAYER_ID,
      ].filter((layerId) => Boolean(map.getLayer(layerId)));

      if (
        interactiveLayers.length > 0 &&
        map.queryRenderedFeatures(event.point, { layers: interactiveLayers }).length > 0
      ) {
        return;
      }

      const point = {
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      };
      if (blankClickTimer !== undefined) window.clearTimeout(blankClickTimer);
      blankClickTimer = window.setTimeout(() => {
        onExploreNearRef.current(point);
        blankClickTimer = undefined;
      }, mobileMode ? 360 : 220);
    };

    const handleBlankMapDoubleClick = () => {
      if (blankClickTimer === undefined) return;
      window.clearTimeout(blankClickTimer);
      blankClickTimer = undefined;
    };

    map.on("moveend", publishViewportGuides);
    map.on("click", handleBlankMapClick);
    map.on("dblclick", handleBlankMapDoubleClick);

    const handleStyleLoad = () => {
      addTerrainLayers(map);

      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: routeFeatureCollection(guideMapRef.current, guideMapSelectionRef.current),
        });

        const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

        map.addLayer(
          {
            id: ROUTE_GLOW_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "rgba(255,248,236,0.92)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 3, 5, 8, 8],
              "line-blur": 1.2,
            },
          },
          firstSymbolLayer,
        );

        map.addLayer(
          {
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#c45237",
              "line-opacity": 0.92,
              "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4],
              "line-dasharray": [2, 1.5],
            },
          },
          firstSymbolLayer,
        );
      }

      if (!map.getSource(GUIDE_CONTENT_SOURCE_ID)) {
        map.addSource(GUIDE_CONTENT_SOURCE_ID, {
          type: "geojson",
          data: guideContentFeatureCollection(
            guideMapRef.current,
            guideMapSelectionRef.current,
          ),
        });

        const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

        map.addLayer(
          {
            id: GUIDE_FOOD_AREA_LAYER_ID,
            type: "circle",
            source: GUIDE_CONTENT_SOURCE_ID,
            filter: ["==", ["get", "kind"], "food-area"],
            paint: {
              "circle-color": "rgba(44, 103, 83, 0.2)",
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 48],
              "circle-stroke-color": "#356958",
              "circle-stroke-width": 2,
              "circle-blur": 0.12,
            },
          },
          firstSymbolLayer,
        );

        map.addLayer(
          {
            id: GUIDE_CONTENT_POINT_LAYER_ID,
            type: "circle",
            source: GUIDE_CONTENT_SOURCE_ID,
            filter: ["==", ["get", "kind"], "attraction"],
            paint: {
              "circle-color": [
                "match",
                ["get", "priority"],
                "A", "#c45237",
                "B", "#d58a42",
                "C", "#55796f",
                "#6f776d",
              ],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5, 13, 8],
              "circle-stroke-color": "#fffaf0",
              "circle-stroke-width": 2.2,
            },
          },
          firstSymbolLayer,
        );

        map.addLayer(
          {
            id: GUIDE_CONTENT_ACTIVE_LAYER_ID,
            type: "circle",
            source: GUIDE_CONTENT_SOURCE_ID,
            filter: ["==", ["get", "active"], 1],
            paint: {
              "circle-color": "rgba(196,82,55,0.16)",
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 12, 14, 21],
              "circle-stroke-color": "#c45237",
              "circle-stroke-width": 3,
            },
          },
          firstSymbolLayer,
        );

        map.addLayer(
          {
            id: ROUTE_STOP_LAYER_ID,
            type: "circle",
            source: GUIDE_CONTENT_SOURCE_ID,
            filter: ["==", ["get", "kind"], "route-stop"],
            paint: {
              "circle-color": "#c45237",
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 9, 14, 13],
              "circle-stroke-color": "#fffaf0",
              "circle-stroke-width": 3,
            },
          },
          firstSymbolLayer,
        );

        map.addLayer(
          {
            id: GUIDE_CONTENT_HIT_LAYER_ID,
            type: "circle",
            source: GUIDE_CONTENT_SOURCE_ID,
            paint: {
              "circle-color": "rgba(0,0,0,0)",
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 20, 14, 28],
            },
          },
          firstSymbolLayer,
        );

        map.addLayer({
          id: GUIDE_CONTENT_LABEL_LAYER_ID,
          type: "symbol",
          source: GUIDE_CONTENT_SOURCE_ID,
          filter: ["!=", ["get", "kind"], "route-stop"],
          layout: {
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 13, 13],
            "text-offset": [0, 1.25],
            "text-anchor": "top",
            "text-optional": true,
            "text-padding": 5,
            "text-max-width": 8,
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": "#243936",
            "text-halo-color": "rgba(251,249,242,0.96)",
            "text-halo-width": 1.8,
          },
        });

        map.addLayer({
          id: ROUTE_STOP_LABEL_LAYER_ID,
          type: "symbol",
          source: GUIDE_CONTENT_SOURCE_ID,
          filter: ["==", ["get", "kind"], "route-stop"],
          layout: {
            "text-field": ["to-string", ["get", "order"]],
            "text-size": 11,
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": "#fffaf0",
            "text-halo-color": "rgba(114,46,31,0.45)",
            "text-halo-width": 0.5,
          },
        });

        map.on("click", GUIDE_CONTENT_HIT_LAYER_ID, (event) => {
          const itemId = String(event.features?.[0]?.properties?.id ?? "");
          if (itemId) onSelectGuideItemRef.current(itemId);
        });

        const setGuidePointerCursor = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const clearGuidePointerCursor = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("mouseenter", GUIDE_CONTENT_HIT_LAYER_ID, setGuidePointerCursor);
        map.on("mouseleave", GUIDE_CONTENT_HIT_LAYER_ID, clearGuidePointerCursor);

        if (!mobileMode && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          map.on("mouseenter", GUIDE_CONTENT_HIT_LAYER_ID, (event) => {
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;
            const card = document.createElement("div");
            card.className = "terrain-popup-card";
            const title = document.createElement("strong");
            title.textContent = String(feature.properties?.name ?? "");
            const detail = document.createElement("span");
            detail.textContent = feature.properties?.kind === "food-area"
              ? "适合在这一带寻找同类风味"
              : feature.properties?.kind === "route-stop"
                ? `线路第 ${String(feature.properties?.order ?? "")} 站`
                : "点击关联攻略卡片";
            card.append(title, detail);
            hoverPopup
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setDOMContent(card)
              .addTo(map);
          });
          map.on("mouseleave", GUIDE_CONTENT_HIT_LAYER_ID, () => hoverPopup.remove());
        }
      }

      if (!map.getSource(GUIDE_SOURCE_ID)) {
        map.addSource(GUIDE_SOURCE_ID, {
          type: "geojson",
          cluster: true,
          clusterMaxZoom: 6,
          clusterRadius: 42,
          clusterProperties: {
            missing_count: [
              "+",
              ["case", ["==", ["get", "coverage"], 0], 1, 0],
            ],
          },
          data: guideFeatureCollection(citiesRef.current),
        });

        map.addLayer({
          id: CLUSTER_PARTIAL_RING_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: [
            "all",
            ["has", "point_count"],
            [">", ["get", "missing_count"], 0],
          ],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": ["step", ["get", "point_count"], 20, 8, 24, 18, 29],
            "circle-stroke-color": "#e3a43b",
            "circle-stroke-width": 3,
            "circle-opacity": 0.98,
          },
        });

        map.addLayer({
          id: CLUSTER_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#46645d",
              8,
              "#365750",
              18,
              "#294a45",
            ],
            "circle-radius": ["step", ["get", "point_count"], 16, 8, 20, 18, 25],
            "circle-stroke-color": "rgba(255,250,240,0.92)",
            "circle-stroke-width": 2.5,
            "circle-opacity": 0.94,
          },
        });

        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: GUIDE_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 11,
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": "#fffaf0",
            "text-halo-color": "rgba(28,55,50,0.3)",
            "text-halo-width": 0.5,
          },
        });

        map.addLayer({
          id: CLUSTER_HIT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": mobileMode
              ? ["step", ["get", "point_count"], 24, 8, 27, 18, 31]
              : ["step", ["get", "point_count"], 20, 8, 24, 18, 29],
          },
        });

        map.addLayer({
          id: GUIDE_POINT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "coverage"], 0],
              "#fffaf0",
              administrativeColorExpression,
            ],
            "circle-radius": administrativeRadiusExpression,
            "circle-stroke-color": [
              "case",
              ["==", ["get", "coverage"], 0],
              administrativeColorExpression,
              "#fff8ec",
            ],
            "circle-stroke-width": [
              "case",
              ["==", ["get", "coverage"], 0],
              2.5,
              2,
            ],
          },
        });

        map.addLayer({
          id: GUIDE_HIT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": mobileMode
              ? ["interpolate", ["linear"], ["zoom"], 3, 24, 7, 27, 10, 30]
              : ["interpolate", ["linear"], ["zoom"], 3, 18, 7, 21, 10, 24],
          },
        });

        map.addLayer({
          id: ACTIVE_POINT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-color": administrativeColorExpression,
            "circle-radius": [
              "match",
              ["get", "administrativeType"],
              "prefecture", 12,
              "county-city", 10.5,
              "county", 9.5,
              "district", 8.5,
              8,
            ],
            "circle-stroke-color": "rgba(255,248,236,0.72)",
            "circle-stroke-width": 6,
          },
        });

        map.addLayer({
          id: GUIDE_LABEL_LAYER_ID,
          type: "symbol",
          source: GUIDE_SOURCE_ID,
          minzoom: 5.2,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "city"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 5.2, 10, 9, 13],
            "text-offset": [0, 1.25],
            "text-anchor": "top",
            "text-optional": true,
            "text-padding": 4,
            "text-max-width": 7,
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": "#243936",
            "text-halo-color": "rgba(251,249,242,0.94)",
            "text-halo-width": 1.8,
          },
        });

        map.on("click", CLUSTER_HIT_LAYER_ID, async (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const source = map.getSource(GUIDE_SOURCE_ID) as GeoJSONSource;
          const clusterId = Number(feature.properties?.cluster_id);
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
            duration: reducedMotionRef.current ? 0 : 520,
          });
        });

        map.on("click", GUIDE_HIT_LAYER_ID, (event) => {
          const guideId = String(event.features?.[0]?.properties?.id ?? "");
          const guide = citiesRef.current.find((item) => item.id === guideId);
          if (guide) onSelectCityRef.current(guide);
        });

        map.on("click", GUIDE_LABEL_LAYER_ID, (event) => {
          const guideId = String(event.features?.[0]?.properties?.id ?? "");
          const guide = citiesRef.current.find((item) => item.id === guideId);
          if (guide) onSelectCityRef.current(guide);
        });

        const setPointerCursor = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const clearPointerCursor = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("mouseenter", CLUSTER_HIT_LAYER_ID, setPointerCursor);
        map.on("mouseleave", CLUSTER_HIT_LAYER_ID, clearPointerCursor);
        map.on("mouseenter", GUIDE_LABEL_LAYER_ID, setPointerCursor);
        map.on("mouseleave", GUIDE_LABEL_LAYER_ID, clearPointerCursor);
        map.on("mouseenter", GUIDE_HIT_LAYER_ID, setPointerCursor);
        map.on("mouseleave", GUIDE_HIT_LAYER_ID, clearPointerCursor);

        if (!mobileMode && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          map.on("mouseenter", GUIDE_HIT_LAYER_ID, (event) => {
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;

            const card = document.createElement("div");
            card.className = "terrain-popup-card";
            const title = document.createElement("strong");
            title.textContent = `${String(feature.properties?.city ?? "")} · ${String(
              feature.properties?.adminArea ?? "",
            )}`;
            const stay = document.createElement("span");
            stay.textContent = `${String(
              feature.properties?.administrativeTypeLabel ?? "",
            )} · ${
              Number(feature.properties?.coverage) === 1 ? "已有攻略" : "尚未收录"
            }`;
            const summary = document.createElement("small");
            summary.textContent = Number(feature.properties?.coverage) === 1
              ? "点击查看城市攻略"
              : "这座城市的攻略还在路上";
            card.append(title, stay, summary);

            hoverPopup
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setDOMContent(card)
              .addTo(map);
          });
          map.on("mouseleave", GUIDE_HIT_LAYER_ID, () => hoverPopup.remove());
        }
      }

      if (!map.getSource(EXPLORE_SOURCE_ID)) {
        map.addSource(EXPLORE_SOURCE_ID, {
          type: "geojson",
          data: exploreFeatureCollection(explorePointRef.current),
        });

        map.addLayer({
          id: EXPLORE_HALO_LAYER_ID,
          type: "circle",
          source: EXPLORE_SOURCE_ID,
          paint: {
            "circle-color": "rgba(196,82,55,0.22)",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 17, 8, 28],
            "circle-blur": 0.5,
            "circle-stroke-color": "rgba(255,248,236,0.74)",
            "circle-stroke-width": 1.5,
          },
        });

        map.addLayer({
          id: EXPLORE_POINT_LAYER_ID,
          type: "circle",
          source: EXPLORE_SOURCE_ID,
          paint: {
            "circle-color": "rgba(196,82,55,0.3)",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 7, 8, 10],
            "circle-stroke-color": "rgba(255,248,236,0.96)",
            "circle-stroke-width": 2.5,
          },
        });
      }

      map.fitBounds(CHINA_BOUNDS, {
        padding: mapPadding(panelLayoutRef.current, containerRef.current),
        duration: 0,
      });
      publishViewportGuides();
      appliedPanelLayoutRef.current = panelLayoutRef.current;
      setMapReady(true);
      setMapFailed(false);
    };

    map.once("style.load", handleStyleLoad);
    map.on("error", () => {
      if (!map.loaded()) setMapFailed(true);
    });

    let resizeFrame = 0;
    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(panFrame);
      window.removeEventListener("keydown", handleArrowDown);
      window.removeEventListener("keyup", handleArrowUp);
      window.removeEventListener("blur", clearArrows);
      resizeFrame = window.requestAnimationFrame(() => {
        map.resize();
        map.setPadding(mapPadding(panelLayoutRef.current, containerRef.current));
        publishViewportGuides();
      });
    };
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(containerRef.current);
    const panelDock = containerRef.current.closest(".experience-shell")?.querySelector(".panel-dock");
    if (panelDock) observer.observe(panelDock);

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      if (blankClickTimer !== undefined) window.clearTimeout(blankClickTimer);
      hoverPopup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(GUIDE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!mapReady || !map || !source) return;
    source.setData(guideFeatureCollection(cities));
  }, [cities, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(EXPLORE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!mapReady || !map || !source) return;
    source.setData(exploreFeatureCollection(explorePoint));
  }, [explorePoint, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const contentSource = map?.getSource(GUIDE_CONTENT_SOURCE_ID) as GeoJSONSource | undefined;
    const routeSource = map?.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!mapReady || !map || !contentSource || !routeSource) return;

    contentSource.setData(guideContentFeatureCollection(guideMap, guideMapSelection));
    routeSource.setData(routeFeatureCollection(guideMap, guideMapSelection));

    const cityLayers = [
      CLUSTER_PARTIAL_RING_LAYER_ID,
      CLUSTER_LAYER_ID,
      CLUSTER_COUNT_LAYER_ID,
      CLUSTER_HIT_LAYER_ID,
      GUIDE_POINT_LAYER_ID,
      GUIDE_HIT_LAYER_ID,
      ACTIVE_POINT_LAYER_ID,
      GUIDE_LABEL_LAYER_ID,
    ];
    const hideCityLayers = Boolean(guideMap && guideMap.scope !== "journey");
    cityLayers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", hideCityLayers ? "none" : "visible");
      }
    });
  }, [guideMap, guideMapSelection, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || appliedPanelLayoutRef.current === panelLayout) return;
    appliedPanelLayoutRef.current = panelLayout;
    map.easeTo({
      padding: mapPadding(panelLayout, containerRef.current),
      duration: reducedMotionRef.current ? 0 : 360,
    });
  }, [mapReady, panelLayout]);

  const exploreLongitude = explorePoint?.longitude;
  const exploreLatitude = explorePoint?.latitude;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer(ACTIVE_POINT_LAYER_ID)) return;
    const highlightedIds = [...new Set([
      ...highlightedCityIds,
      ...(activeCityId ? [activeCityId] : []),
    ])];
    map.setFilter(
      ACTIVE_POINT_LAYER_ID,
      highlightedIds.length > 0
        ? ["in", ["get", "id"], ["literal", highlightedIds]]
        : ["==", ["get", "id"], ""],
    );
  }, [activeCityId, highlightedCityIds, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (preserveViewport) return;

    const padding = mapPadding(panelLayoutRef.current, containerRef.current);

    if (guideMap) {
      const contentPadding = isMobileMapExperience()
        ? {
            top: 72,
            right: 18,
            bottom: Math.min(padding.bottom, Math.round(window.innerHeight * 0.4)),
            left: 18,
          }
        : padding;
      const places = visibleGuidePlaces(guideMap, guideMapSelection);
      const selected = guideMapSelection.itemId
        ? places.find((place) => place.id === guideMapSelection.itemId)
        : undefined;

      if (selected) {
        map.flyTo({
          center: [selected.longitude, selected.latitude],
          zoom: Math.max(map.getZoom(), selected.kind === "food-area" ? 12.4 : 13),
          pitch: terrainEnabledRef.current ? 34 : 0,
          padding: contentPadding,
          duration: reducedMotionRef.current ? 0 : 620,
        });
        return;
      }

      if (places.length === 1) {
        map.flyTo({
          center: [places[0].longitude, places[0].latitude],
          zoom: 12,
          pitch: terrainEnabledRef.current ? 34 : 0,
          padding: contentPadding,
          duration: reducedMotionRef.current ? 0 : 620,
        });
        return;
      }

      if (places.length > 1) {
        const longitudes = places.map((place) => place.longitude);
        const latitudes = places.map((place) => place.latitude);
        const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
        const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
        const span = Math.max(longitudeSpan * 0.86, latitudeSpan);
        const zoom = span > 0.45
          ? 8.2
          : span > 0.18
            ? 9.2
            : span > 0.08
              ? 10.35
              : 11.75;
        map.easeTo({
          center: [
            (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
            (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
          ],
          zoom,
          padding: contentPadding,
          pitch: terrainEnabledRef.current ? 30 : 0,
          duration: reducedMotionRef.current ? 0 : 720,
        });
        return;
      }
    }

    if (activeCityId) {
      const guide = citiesRef.current.find((item) => item.id === activeCityId);
      if (!guide) return;
      map.flyTo({
        center: [guide.coordinates.longitude, guide.coordinates.latitude],
        zoom: Math.max(map.getZoom(), 6.4),
        pitch: terrainEnabledRef.current ? 38 : 0,
        padding,
        duration: reducedMotionRef.current ? 0 : 720,
      });
      return;
    }

    if (exploreLongitude !== undefined && exploreLatitude !== undefined) {
      map.flyTo({
        center: [exploreLongitude, exploreLatitude],
        zoom: Math.max(map.getZoom(), 5.1),
        pitch: terrainEnabledRef.current ? 32 : 0,
        padding,
        duration: reducedMotionRef.current ? 0 : 680,
      });
      return;
    }

    map.fitBounds(CHINA_BOUNDS, {
      padding,
      pitch: terrainEnabledRef.current ? 18 : 0,
      bearing: 0,
      duration: reducedMotionRef.current ? 0 : 720,
    });
  }, [
    activeCityId,
    exploreLatitude,
    exploreLongitude,
    guideMap,
    guideMapSelection,
    mapReady,
    preserveViewport,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || resetSignal === 0) return;
    map.fitBounds(CHINA_BOUNDS, {
      padding: mapPadding(panelLayoutRef.current, containerRef.current),
      pitch: terrainEnabledRef.current ? 18 : 0,
      bearing: 0,
      duration: reducedMotionRef.current ? 0 : 720,
    });
  }, [mapReady, resetSignal]);

  const toggleTerrain = () => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const next = !terrainEnabled;
    terrainEnabledRef.current = next;
    setTerrainEnabled(next);
    map.setTerrain(next ? { source: TERRAIN_SOURCE_ID, exaggeration: 0.72 } : null);
    map.easeTo({
      pitch: next ? (activeCityId ? 38 : 18) : 0,
      duration: reducedMotionRef.current ? 0 : 480,
    });
  };

  const toggleClustering = async () => {
    const source = mapRef.current?.getSource(GUIDE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    const next = !clusterEnabled;
    setClusterEnabled(next);
    await source.setClusterOptions({
      cluster: next,
      clusterMaxZoom: 6,
      clusterRadius: 42,
    });
  };

  return (
    <div
      className={`terrain-map-shell is-panel-${panelLayout}${
        mapReady ? " is-ready" : ""
      }${mobileExperience ? " is-mobile-experience" : ""}`}
      data-panel-layout={panelLayout}
    >
      <div
        ref={containerRef}
        className="terrain-map"
        role="region"
        aria-label={guideMap
          ? "可拖动和缩放的攻略联动地图，显示当前成都攻略内容"
          : "可拖动和双指缩放的中国城市地形地图，最大缩放级别 16"}
      />

      {!mapReady && !mapFailed && (
        <div className="terrain-map-loading" aria-live="polite">
          <span />
          正在展开地形
        </div>
      )}

      {mapFailed && !mapReady && (
        <div className="terrain-map-error" role="status">
          <strong>地形图暂时没有加载出来</strong>
          <span>城市列表和攻略仍然可以正常使用。</span>
        </div>
      )}

      {!guideMap && (
        <button
          type="button"
          className={`cluster-toggle${clusterEnabled ? " is-active" : ""}`}
          onClick={toggleClustering}
          aria-pressed={clusterEnabled}
          aria-label={clusterEnabled ? "关闭城市点聚合" : "开启城市点聚合"}
        >
          <span className="cluster-toggle__dots" aria-hidden="true"><i /><i /><i /></span>
          聚合
        </button>
      )}

      <button
        type="button"
        className={`terrain-toggle${terrainEnabled ? " is-active" : ""}`}
        onClick={toggleTerrain}
        aria-pressed={terrainEnabled}
      >
        <span aria-hidden="true" />
        {terrainEnabled ? "立体" : "平面"}
      </button>

      <div
        className={`map-legend${guideMap ? " is-guide-map" : ""}`}
        aria-label={guideMap ? "攻略地图图例" : "行政层级地图图例"}
      >
        {guideMap ? (
          guideMapSelection.mode === "itinerary" ? (
            <>
              <span><i className="legend-dot" /> 线路顺序</span>
              <span>游览次序示意</span>
            </>
          ) : guideMapSelection.mode === "food" ? (
            <>
              <span><i className="legend-dot is-food-area" /> 美食片区</span>
              <span>适合就近选择</span>
            </>
          ) : (
            <>
              <span><i className="legend-dot" /> 首访核心</span>
              <span><i className="legend-dot is-secondary" /> 补充选择</span>
            </>
          )
        ) : (
          <>
            {ADMINISTRATIVE_TYPE_LEGEND.map(({ type, label, color }) => (
              <span key={type}>
                <i className="legend-dot" style={{ backgroundColor: color, borderColor: color }} />
                {label}
              </span>
            ))}
            <span className="legend-status">
              <i className="legend-dot is-hollow" /> 空心为尚未收录
            </span>
          </>
        )}
      </div>
    </div>
  );
}
