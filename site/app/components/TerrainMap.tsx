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
import type { TravelGuide } from "../generated/guides";

const BASE_STYLE = "https://tiles.openfreemap.org/styles/bright";
const TERRAIN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
const TERRAIN_SOURCE_ID = "travel-terrain";
const HILLSHADE_SOURCE_ID = "travel-hillshade-dem";
const HILLSHADE_LAYER_ID = "travel-hillshade";
const ROUTE_SOURCE_ID = "travel-itinerary-route";
const ROUTE_GLOW_LAYER_ID = "travel-route-glow";
const ROUTE_LAYER_ID = "travel-route";
const GUIDE_SOURCE_ID = "travel-guide-points";
const CLUSTER_LAYER_ID = "travel-guide-clusters";
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
  guides: TravelGuide[];
  activeGuideId?: string;
  showItineraryRoute: boolean;
  itineraryActive: boolean;
  panelLayout: "collapsed" | "docked" | "expanded";
  explorePoint?: { longitude: number; latitude: number };
  onSelectGuide: (guide: TravelGuide) => void;
  onExploreNear: (point: { longitude: number; latitude: number }) => void;
  onExploreRandom: () => void;
  onViewportGuidesChange: (ids: string[]) => void;
  onReset: () => void;
};

type PanelLayout = TerrainMapProps["panelLayout"];
type ExplorePoint = NonNullable<TerrainMapProps["explorePoint"]>;

const shortCityName = (name: string) => name.replace(/[市区]$/, "");

const mapPadding = (layout: PanelLayout) => {
  if (typeof window === "undefined") {
    return {
      top: 86,
      right: layout === "collapsed" ? 42 : layout === "expanded" ? 790 : 530,
      bottom: 42,
      left: 42,
    };
  }

  if (window.matchMedia("(max-width: 840px)").matches) {
    const compactMobile = window.matchMedia("(max-width: 520px)").matches;
    const dockedSheetRatio = compactMobile ? 0.47 : 0.44;
    return {
      top: 76,
      right: 24,
      bottom:
        layout === "collapsed"
          ? 84
          : layout === "expanded"
            ? Math.round(window.innerHeight * 0.22)
            : Math.max(280, Math.round(window.innerHeight * dockedSheetRatio)) + 20,
      left: 24,
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

const guideFeatureCollection = (guides: TravelGuide[]) => ({
  type: "FeatureCollection" as const,
  features: guides.map((guide) => ({
    type: "Feature" as const,
    properties: {
      id: guide.id,
      city: shortCityName(guide.city),
      adminArea: guide.adminArea,
      stay: guide.suggestedStay.split(/[；。]/)[0],
      summary: guide.summary,
      completeness: guide.completeness,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [guide.coordinates.longitude, guide.coordinates.latitude],
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

  if (!map.getSource(HILLSHADE_SOURCE_ID)) {
    map.addSource(HILLSHADE_SOURCE_ID, {
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
        source: HILLSHADE_SOURCE_ID,
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

  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 0.72 });
};

export default function TerrainMap({
  guides,
  activeGuideId,
  showItineraryRoute,
  itineraryActive,
  panelLayout,
  explorePoint,
  onSelectGuide,
  onExploreNear,
  onExploreRandom,
  onViewportGuidesChange,
  onReset,
}: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const guidesRef = useRef(guides);
  const onSelectGuideRef = useRef(onSelectGuide);
  const onExploreNearRef = useRef(onExploreNear);
  const onExploreRandomRef = useRef(onExploreRandom);
  const onViewportGuidesChangeRef = useRef(onViewportGuidesChange);
  const onResetRef = useRef(onReset);
  const showItineraryRouteRef = useRef(showItineraryRoute);
  const itineraryActiveRef = useRef(itineraryActive);
  const panelLayoutRef = useRef(panelLayout);
  const appliedPanelLayoutRef = useRef<PanelLayout | null>(null);
  const explorePointRef = useRef(explorePoint);
  const terrainEnabledRef = useRef(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(true);

  useEffect(() => {
    guidesRef.current = guides;
    onSelectGuideRef.current = onSelectGuide;
    onExploreNearRef.current = onExploreNear;
    onExploreRandomRef.current = onExploreRandom;
    onViewportGuidesChangeRef.current = onViewportGuidesChange;
    onResetRef.current = onReset;
  }, [guides, onExploreNear, onExploreRandom, onReset, onSelectGuide, onViewportGuidesChange]);

  useEffect(() => {
    showItineraryRouteRef.current = showItineraryRoute;
    itineraryActiveRef.current = itineraryActive;
  }, [itineraryActive, showItineraryRoute]);

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
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [104.4, 35.4],
      zoom: 3.2,
      minZoom: 1.8,
      maxZoom: 16,
      pitch: 18,
      bearing: 0,
      maxPitch: 60,
      renderWorldCopies: false,
      attributionControl: false,
      fadeDuration: 180,
    });

    mapRef.current = map;
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

    const publishViewportGuides = () => {
      if (!map.getSource(GUIDE_SOURCE_ID)) return;
      const padding = mapPadding(panelLayoutRef.current);
      const canvas = map.getCanvas();
      const visibleGuideIds = guidesRef.current
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
      onViewportGuidesChangeRef.current(visibleGuideIds);
    };

    const handleBlankMapClick = (event: MapMouseEvent) => {
      const interactiveLayers = [
        CLUSTER_LAYER_ID,
        CLUSTER_COUNT_LAYER_ID,
        GUIDE_POINT_LAYER_ID,
        GUIDE_HIT_LAYER_ID,
        ACTIVE_POINT_LAYER_ID,
        GUIDE_LABEL_LAYER_ID,
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
      }, 220);
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

      const routeGuides = ["杭州市", "苏州市", "上海市"]
        .map((city) => guidesRef.current.find((guide) => guide.city === city))
        .filter((guide): guide is TravelGuide => Boolean(guide));

      if (!map.getSource(ROUTE_SOURCE_ID) && routeGuides.length > 1) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeGuides.map((guide) => [
                guide.coordinates.longitude,
                guide.coordinates.latitude,
              ]),
            },
          },
        });

        const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        const visibility = showItineraryRouteRef.current ? "visible" : "none";

        map.addLayer(
          {
            id: ROUTE_GLOW_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { visibility, "line-cap": "round", "line-join": "round" },
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
            layout: { visibility, "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#c45237",
              "line-opacity": itineraryActiveRef.current ? 0.96 : 0.72,
              "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 4],
              "line-dasharray": [2, 1.5],
            },
          },
          firstSymbolLayer,
        );
      }

      if (!map.getSource(GUIDE_SOURCE_ID)) {
        map.addSource(GUIDE_SOURCE_ID, {
          type: "geojson",
          cluster: true,
          clusterMaxZoom: 6,
          clusterRadius: 42,
          data: guideFeatureCollection(guidesRef.current),
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
          id: GUIDE_POINT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "completeness"], "partial"],
              "#fffaf0",
              "#c45237",
            ],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4.5, 7, 6.5, 10, 8],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "completeness"], "partial"],
              "#c45237",
              "#fff8ec",
            ],
            "circle-stroke-width": 2,
          },
        });

        map.addLayer({
          id: GUIDE_HIT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 7, 21, 10, 24],
          },
        });

        map.addLayer({
          id: ACTIVE_POINT_LAYER_ID,
          type: "circle",
          source: GUIDE_SOURCE_ID,
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-color": "#c45237",
            "circle-radius": 9,
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

        map.on("click", CLUSTER_LAYER_ID, async (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const source = map.getSource(GUIDE_SOURCE_ID) as GeoJSONSource;
          const clusterId = Number(feature.properties?.cluster_id);
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
            duration: 520,
          });
        });

        map.on("click", GUIDE_HIT_LAYER_ID, (event) => {
          const guideId = String(event.features?.[0]?.properties?.id ?? "");
          const guide = guidesRef.current.find((item) => item.id === guideId);
          if (guide) onSelectGuideRef.current(guide);
        });

        map.on("click", GUIDE_LABEL_LAYER_ID, (event) => {
          const guideId = String(event.features?.[0]?.properties?.id ?? "");
          const guide = guidesRef.current.find((item) => item.id === guideId);
          if (guide) onSelectGuideRef.current(guide);
        });

        const setPointerCursor = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const clearPointerCursor = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("mouseenter", CLUSTER_LAYER_ID, setPointerCursor);
        map.on("mouseleave", CLUSTER_LAYER_ID, clearPointerCursor);
        map.on("mouseenter", GUIDE_LABEL_LAYER_ID, setPointerCursor);
        map.on("mouseleave", GUIDE_LABEL_LAYER_ID, clearPointerCursor);
        map.on("mouseenter", GUIDE_HIT_LAYER_ID, (event) => {
          setPointerCursor();
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;

          const card = document.createElement("div");
          card.className = "terrain-popup-card";
          const title = document.createElement("strong");
          title.textContent = `${String(feature.properties?.city ?? "")} · ${String(
            feature.properties?.adminArea ?? "",
          )}`;
          const stay = document.createElement("span");
          stay.textContent = String(feature.properties?.stay ?? "");
          const summary = document.createElement("small");
          const summaryText = String(feature.properties?.summary ?? "");
          summary.textContent = summaryText.length > 46 ? `${summaryText.slice(0, 46)}…` : summaryText;
          card.append(title, stay, summary);

          hoverPopup
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setDOMContent(card)
            .addTo(map);
        });
        map.on("mouseleave", GUIDE_HIT_LAYER_ID, () => {
          clearPointerCursor();
          hoverPopup.remove();
        });
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
        padding: mapPadding(panelLayoutRef.current),
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

    const observer = new ResizeObserver(() => {
      map.resize();
      map.setPadding(mapPadding(panelLayoutRef.current));
      publishViewportGuides();
    });
    observer.observe(containerRef.current);

    return () => {
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
    source.setData(guideFeatureCollection(guides));
  }, [guides, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(EXPLORE_SOURCE_ID) as GeoJSONSource | undefined;
    if (!mapReady || !map || !source) return;
    source.setData(exploreFeatureCollection(explorePoint));
  }, [explorePoint, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || appliedPanelLayoutRef.current === panelLayout) return;
    appliedPanelLayoutRef.current = panelLayout;
    map.easeTo({
      padding: mapPadding(panelLayout),
      duration: 360,
      essential: true,
    });
  }, [mapReady, panelLayout]);

  const exploreLongitude = explorePoint?.longitude;
  const exploreLatitude = explorePoint?.latitude;

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (map.getLayer(ACTIVE_POINT_LAYER_ID)) {
      map.setFilter(ACTIVE_POINT_LAYER_ID, ["==", ["get", "id"], activeGuideId ?? ""]);
    }

    const padding = mapPadding(panelLayoutRef.current);

    if (activeGuideId) {
      const guide = guidesRef.current.find((item) => item.id === activeGuideId);
      if (!guide) return;
      map.flyTo({
        center: [guide.coordinates.longitude, guide.coordinates.latitude],
        zoom: Math.max(map.getZoom(), 6.4),
        pitch: terrainEnabledRef.current ? 38 : 0,
        padding,
        duration: 720,
        essential: true,
      });
      return;
    }

    if (itineraryActive) {
      map.fitBounds(
        [
          [119.6, 29.7],
          [122.0, 32.0],
        ],
        {
          padding,
          pitch: terrainEnabledRef.current ? 34 : 0,
          duration: 720,
        },
      );
      return;
    }

    if (exploreLongitude !== undefined && exploreLatitude !== undefined) {
      map.flyTo({
        center: [exploreLongitude, exploreLatitude],
        zoom: Math.max(map.getZoom(), 5.1),
        pitch: terrainEnabledRef.current ? 32 : 0,
        padding,
        duration: 680,
        essential: true,
      });
      return;
    }

    map.fitBounds(CHINA_BOUNDS, {
      padding,
      pitch: terrainEnabledRef.current ? 18 : 0,
      bearing: 0,
      duration: 720,
    });
  }, [activeGuideId, exploreLatitude, exploreLongitude, itineraryActive, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(ROUTE_LAYER_ID)) return;
    const visibility = showItineraryRoute ? "visible" : "none";
    map.setLayoutProperty(ROUTE_LAYER_ID, "visibility", visibility);
    map.setLayoutProperty(ROUTE_GLOW_LAYER_ID, "visibility", visibility);
    map.setPaintProperty(ROUTE_LAYER_ID, "line-opacity", itineraryActive ? 0.96 : 0.72);
  }, [itineraryActive, mapReady, showItineraryRoute]);

  const toggleTerrain = () => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const next = !terrainEnabled;
    terrainEnabledRef.current = next;
    setTerrainEnabled(next);
    map.setTerrain(next ? { source: TERRAIN_SOURCE_ID, exaggeration: 0.72 } : null);
    map.easeTo({ pitch: next ? (activeGuideId ? 38 : 18) : 0, duration: 480 });
  };

  const resetMap = () => {
    onResetRef.current();
    mapRef.current?.fitBounds(CHINA_BOUNDS, {
      padding: mapPadding(panelLayoutRef.current),
      pitch: terrainEnabledRef.current ? 18 : 0,
      bearing: 0,
      duration: 720,
    });
  };

  const exploreMapCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    onExploreNearRef.current({ longitude: center.lng, latitude: center.lat });
  };

  const exploreRandomly = () => {
    onExploreRandomRef.current();
  };

  return (
    <div className={`terrain-map-shell${mapReady ? " is-ready" : ""}`}>
      <div
        ref={containerRef}
        className="terrain-map"
        role="region"
        aria-label="可缩放的中国城市地形地图"
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

      <div className="map-toolbar" aria-label="地图控制">
        <button type="button" onClick={() => mapRef.current?.zoomIn({ duration: 220 })} aria-label="放大地图">
          ＋
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut({ duration: 220 })} aria-label="缩小地图">
          −
        </button>
        <button type="button" onClick={resetMap} aria-label="回到全国视图">
          ◎
        </button>
        <button
          type="button"
          className="map-toolbar-action"
          onClick={exploreMapCenter}
          aria-label="探索地图中心附近"
          title="探索地图中心附近"
        >
          <span className="map-toolbar-action-icon" aria-hidden="true">⌖</span>
          <span className="map-toolbar-action-label">附近</span>
        </button>
        <button
          type="button"
          className="map-toolbar-action"
          onClick={exploreRandomly}
          aria-label="随机探索"
          title="随机探索"
        >
          <span className="map-toolbar-action-icon" aria-hidden="true">✦</span>
          <span className="map-toolbar-action-label">随机</span>
        </button>
      </div>

      <button
        type="button"
        className={`terrain-toggle${terrainEnabled ? " is-active" : ""}`}
        onClick={toggleTerrain}
        aria-pressed={terrainEnabled}
      >
        <span aria-hidden="true" />
        {terrainEnabled ? "立体地形" : "平面地形"}
      </button>

      <div className="map-legend" aria-hidden="true">
        <span><i className="legend-dot" /> 城市攻略</span>
        <span><i className="legend-dot is-hollow" /> 待补全</span>
      </div>
    </div>
  );
}
