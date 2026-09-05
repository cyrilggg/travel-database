"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import GuideBrowser from "./GuideBrowser";
import GuideStructureLoader from "./GuideStructureLoader";
import JourneyPlanner from "./JourneyPlanner";
import TerrainMap from "./TerrainMap";
import {
  coveredCityCount,
  guides,
  mapCities,
  targetCityCount,
  type GuideBrowseItem,
  type GuideBrowseKey,
  type MapCity,
  type TravelGuide,
} from "../generated/publicGuides";
import {
  getGuideMapContent,
  getGuideMapItemId,
  mapModeForSection,
  type GuideMapMode,
  type GuideMapSelection,
} from "./guideMapData";
import { buildJourneyPlan } from "./journeyPlannerLogic";
import { administrativeTypeInfoOf } from "./administrativeType";

type PanelState =
  | { kind: "home" }
  | { kind: "planner" }
  | { kind: "city"; guideId: string }
  | { kind: "missing"; cityId: string }
  | { kind: "nearby"; longitude: number; latitude: number };

type PanelLayout = "collapsed" | "docked" | "expanded";

type MapPoint = {
  longitude: number;
  latitude: number;
};

const cityName = (name: string) => name.replace(/[市区]$/, "");
const mappedGuideIds = new Set(
  mapCities.flatMap((city) => (city.guideId ? [city.guideId] : [])),
);
const coveredGuides = guides.filter((guide) => mappedGuideIds.has(guide.id));
const planningCities = mapCities.filter((city) => city.coverage === 1 && city.guideId);

const formatDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
};

const distanceInKilometers = (from: MapPoint, to: MapPoint) => {
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
};

const formatDistance = (distance: number) => {
  if (distance < 20) return `约 ${Math.max(1, Math.round(distance))} km`;
  if (distance < 100) return `约 ${Math.round(distance / 5) * 5} km`;
  return `约 ${Math.round(distance / 10) * 10} km`;
};

const nearestGuides = (point: MapPoint, limit: number, excludedGuideId?: string) =>
  coveredGuides
    .filter((guide) => guide.id !== excludedGuideId)
    .map((guide) => ({
      guide,
      distance: distanceInKilometers(point, guide.coordinates),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

export default function TravelMap() {
  const [panel, setPanel] = useState<PanelState>({ kind: "home" });
  const [panelLayout, setPanelLayout] = useState<PanelLayout>("docked");
  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityScope, setCityScope] = useState<"viewport" | "all">("viewport");
  const [viewportCityIds, setViewportCityIds] = useState<string[]>(() =>
    mapCities.map((city) => city.id),
  );
  const [guideMapSelection, setGuideMapSelection] = useState<GuideMapSelection>({
    mode: "overview",
  });
  const [journeyGenerated, setJourneyGenerated] = useState(false);
  const [journeyCityIds, setJourneyCityIds] = useState<string[]>([]);
  const [journeyDaysByCityId, setJourneyDaysByCityId] = useState<Record<string, number>>({});
  const [journeyStartCityId, setJourneyStartCityId] = useState<string>();
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelDockToggleRef = useRef<HTMLButtonElement>(null);

  const panelExpanded = panelLayout === "expanded";
  const panelCollapsed = panelLayout === "collapsed";
  const viewportCityIdSet = useMemo(() => new Set(viewportCityIds), [viewportCityIds]);
  const listedCities = useMemo(
    () =>
      cityScope === "viewport"
        ? mapCities.filter((city) => viewportCityIdSet.has(city.id))
        : mapCities,
    [cityScope, viewportCityIdSet],
  );

  const sortedCities = useMemo(
    () =>
      [...listedCities].sort(
        (a, b) =>
          a.adminArea.localeCompare(b.adminArea, "zh-CN") ||
          a.city.localeCompare(b.city, "zh-CN"),
      ),
    [listedCities],
  );

  const cityGroups = useMemo(() => {
    const groups = new Map<string, MapCity[]>();
    sortedCities.forEach((city) => {
      const group = groups.get(city.adminArea) ?? [];
      group.push(city);
      groups.set(city.adminArea, group);
    });
    return [...groups.entries()];
  }, [sortedCities]);

  const activeGuide =
    panel.kind === "city"
      ? guides.find((guide) => guide.id === panel.guideId)
      : undefined;

  const activeMapCity =
    panel.kind === "missing"
      ? mapCities.find((city) => city.id === panel.cityId)
      : activeGuide
        ? mapCities.find((city) => city.guideId === activeGuide.id)
        : undefined;

  const activeGuideMap = activeGuide ? getGuideMapContent(activeGuide.id) : undefined;
  const journeyPlan = buildJourneyPlan(
    planningCities,
    journeyCityIds,
    journeyDaysByCityId,
    journeyStartCityId,
  );
  const journeyGuideMap = panel.kind === "planner" && journeyGenerated && journeyPlan.stops.length > 0
    ? {
        guideId: "cross-city-planner",
        scope: "journey" as const,
        places: journeyPlan.stops.map((stop) => ({
          id: `journey-city:${stop.city.id}`,
          name: cityName(stop.city.city),
          longitude: stop.city.coordinates.longitude,
          latitude: stop.city.coordinates.latitude,
          kind: "attraction" as const,
          itemTitles: [cityName(stop.city.city)],
          priority: "route" as const,
          featured: true,
        })),
        routes: journeyPlan.stops.length > 1
          ? [{
              id: "cross-city-route",
              title: "跨城路线",
              itemTitle: "行程规划",
              stops: journeyPlan.stops.map((stop) => ({ placeId: `journey-city:${stop.city.id}` })),
            }]
          : [],
      }
    : undefined;
  const mapGuideMap = journeyGuideMap ?? activeGuideMap;
  const mapGuideSelection: GuideMapSelection = journeyGuideMap
    ? journeyGuideMap.routes.length > 0
      ? { mode: "itinerary", routeId: "cross-city-route" }
      : { mode: "attractions" }
    : guideMapSelection;

  const resolveGuideMapItemId = (key: GuideBrowseKey, item: GuideBrowseItem) =>
    activeGuideMap ? getGuideMapItemId(activeGuideMap, key, item) : undefined;

  const explorePoint =
    panel.kind === "nearby"
      ? { longitude: panel.longitude, latitude: panel.latitude }
      : undefined;

  const panelDockContext =
    activeMapCity
      ? `${cityName(activeMapCity.city)} · ${administrativeTypeInfoOf(activeMapCity).label} · ${activeMapCity.coverage === 1 ? "已有攻略" : "尚未收录"}`
      : activeGuide
      ? `${cityName(activeGuide.city)}攻略`
      : panel.kind === "planner"
        ? "行程规划"
      : panel.kind === "nearby"
        ? "附近攻略"
        : "攻略";

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelScrollRef.current?.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [panel]);

  useEffect(() => {
    if (panelCollapsed) {
      panelDockToggleRef.current?.focus({ preventScroll: true });
    }
  }, [panelCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        ) {
          return;
        }
        setPanelLayout((layout) =>
          layout === "expanded" ? "docked" : "collapsed",
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openGuide = (guide: TravelGuide) => {
    setPanel({ kind: "city", guideId: guide.id });
    setPanelLayout("docked");
    setGuideMapSelection({ mode: "overview" });
  };

  const openMapCity = (city: MapCity) => {
    if (panel.kind === "planner") {
      if (!journeyGenerated && city.coverage === 1) toggleJourneyCity(city.id);
      return;
    }
    if (city.coverage === 1 && city.guideId) {
      const guide = guides.find((candidate) => candidate.id === city.guideId);
      if (guide) {
        openGuide(guide);
        return;
      }
    }
    setPanel({ kind: "missing", cityId: city.id });
    setPanelLayout("docked");
  };

  const openHome = (scope?: "viewport" | "all") => {
    setPanel({ kind: "home" });
    setPanelLayout("docked");
    if (scope) setCityScope(scope);
  };

  const openJourneyPlanner = () => {
    setPanel({ kind: "planner" });
    setPanelLayout("docked");
    setJourneyGenerated(false);
  };

  const openNearby = (point: MapPoint) => {
    if (panel.kind === "planner") return;
    setPanel({ kind: "nearby", ...point });
    setPanelLayout("docked");
  };

  const togglePanelReadingWidth = () => {
    setPanelLayout(panelExpanded ? "docked" : "expanded");
  };

  const hidePanel = () => {
    setPanelLayout("collapsed");
  };

  const exploreRandomGuide = () => {
    const scopedGuideIds = new Set(
      listedCities.flatMap((city) => (city.guideId ? [city.guideId] : [])),
    );
    const scopedGuides = coveredGuides.filter((guide) => scopedGuideIds.has(guide.id));
    const candidates = activeGuide
      ? scopedGuides.filter((guide) => guide.id !== activeGuide.id)
      : scopedGuides;
    const pool = candidates.length > 0 ? candidates : coveredGuides;
    const guide = pool[Math.floor(Math.random() * pool.length)];
    openGuide(guide);
  };

  const resetToNation = () => {
    openHome("viewport");
    setMapResetSignal((signal) => signal + 1);
  };

  const updateViewportCities = (ids: string[]) => {
    setViewportCityIds((current) => {
      if (
        current.length === ids.length &&
        current.every((id, index) => id === ids[index])
      ) {
        return current;
      }
      return ids;
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = searchQuery.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) {
      openHome();
      return;
    }

    const cityMatch = mapCities.find((city) =>
      `${city.city}${city.adminArea}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized),
    );
    if (cityMatch) {
      openMapCity(cityMatch);
      setSearchQuery(cityName(cityMatch.city));
      return;
    }

    const match = coveredGuides.find((guide) =>
      `${guide.city}${guide.adminArea}${guide.keywords.join(" ")}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized),
    );
    if (match) {
      openGuide(match);
      setSearchQuery(cityName(match.city));
    }
  };

  const selectGuideMapMode = (mode: GuideMapMode) => {
    if (mode === "itinerary") {
      setGuideMapSelection({
        mode,
        routeId: activeGuideMap?.routes[0]?.id,
      });
      return;
    }
    setGuideMapSelection({ mode });
  };

  const handleGuideSectionOpen = (key: GuideBrowseKey) => {
    const mode = mapModeForSection(key);
    if (mode) selectGuideMapMode(mode);
  };

  const handleGuideMapItemSelect = (
    key: GuideBrowseKey,
    _item: GuideBrowseItem,
    mapItemId: string,
  ) => {
    if (key === "itinerary") {
      setGuideMapSelection({
        mode: "itinerary",
        routeId: mapItemId,
        itemTitle: _item.title,
      });
      return;
    }
    const mode = mapModeForSection(key) ?? "overview";
    setGuideMapSelection({ mode, itemId: mapItemId, itemTitle: _item.title });
  };

  const toggleJourneyCity = (cityId: string) => {
    const selected = journeyCityIds.includes(cityId);
    const next = selected
      ? journeyCityIds.filter((id) => id !== cityId)
      : [...journeyCityIds, cityId];
    setJourneyCityIds(next);
    setJourneyGenerated(false);
    setJourneyDaysByCityId((current) => {
      if (!selected) return { ...current, [cityId]: current[cityId] ?? 1 };
      const updated = { ...current };
      delete updated[cityId];
      return updated;
    });
    if (!journeyStartCityId && !selected) setJourneyStartCityId(cityId);
    if (selected && journeyStartCityId === cityId) setJourneyStartCityId(next[0]);
  };

  const changeJourneyDays = (cityId: string, days: number) => {
    setJourneyGenerated(false);
    setJourneyDaysByCityId((current) => ({
      ...current,
      [cityId]: Math.max(1, Math.min(14, days)),
    }));
  };

  const clearJourney = () => {
    setJourneyCityIds([]);
    setJourneyDaysByCityId({});
    setJourneyStartCityId(undefined);
    setJourneyGenerated(false);
  };

  const setJourneyStart = (cityId: string) => {
    setJourneyStartCityId(cityId);
    setJourneyGenerated(false);
  };

  const handleMapGuideItemSelect = (itemId: string) => {
    if (itemId.startsWith("journey-city:")) {
      return;
    }
    const place = activeGuideMap?.places.find((candidate) => candidate.id === itemId);
    if (!place) return;
    setGuideMapSelection({
      mode: place.kind === "food-area" ? "food" : "attractions",
      itemId,
      itemTitle: place.itemTitles[0],
    });
    if (panelCollapsed) setPanelLayout("docked");
  };

  const renderHome = () => (
    <div className="panel-home">
      <p className="panel-eyebrow">旅行地图</p>
      <h2>从地图开始</h2>
      <p className="panel-intro">
        地图颜色区分地级市、县级市、县与区；实心表示已有攻略，空心表示尚未收录。拖动或缩放地图，目录会跟着当前视野变化。
      </p>

      <section className="planning-entry" aria-labelledby="planning-entry-title">
        <button
          type="button"
          className="planning-entry__button"
          onClick={openJourneyPlanner}
        >
          <span className="planning-entry__mark" aria-hidden="true">程</span>
          <span className="planning-entry__copy">
            <strong id="planning-entry-title">行程规划</strong>
            <small>跨城市选择目的地，分配停留天数并生成路线</small>
          </span>
          <span className="planning-entry__action">
            开始规划
            <i aria-hidden="true">→</i>
          </span>
        </button>
      </section>

      <div className="coverage-summary" aria-label="城市攻略覆盖进度">
        <strong>{coveredCityCount}</strong>
        <span>座城市已有攻略 · {targetCityCount - coveredCityCount} 座尚未收录</span>
      </div>

      <button className="random-explore" type="button" onClick={exploreRandomGuide}>
        <span className="random-explore__compass" aria-hidden="true">✦</span>
        <span>
          <strong>随便看看</strong>
          <small>让地图带我去一座城市</small>
        </span>
        <span className="random-explore__arrow" aria-hidden="true">→</span>
      </button>

      <div className="map-scope-row">
        <div className="map-scope-toggle" role="group" aria-label="城市目录范围">
          <button
            type="button"
            className={cityScope === "viewport" ? "is-active" : ""}
            onClick={() => setCityScope("viewport")}
          >
            当前地图
          </button>
          <button
            type="button"
            className={cityScope === "all" ? "is-active" : ""}
            onClick={() => setCityScope("all")}
          >
            全部城市
          </button>
        </div>
        <span className="map-status-dot" aria-live="polite">
          {cityScope === "viewport" ? "跟随地图" : "完整目录"}
        </span>
      </div>

      <div className="panel-section-heading">
        <div>
          <span>{cityScope === "viewport" ? "当前视野" : "城市目录"}</span>
          <small>{cityScope === "viewport" ? "拖动地图即可更新" : "按省份浏览"}</small>
        </div>
      </div>

      {cityGroups.length > 0 ? (
        <div className="province-city-groups">
          {cityGroups.map(([adminArea, areaCities]) => (
            <section className="province-city-group" key={adminArea}>
              <h3>{adminArea}</h3>
              <div className="city-index">
                {areaCities.map((city) => (
                  <button
                    key={city.id}
                    className={city.coverage === 0 ? "is-missing" : ""}
                    type="button"
                    onClick={() => openMapCity(city)}
                  >
                    <span className="city-index__name">
                      <i
                        className="city-type-dot"
                        style={{ backgroundColor: administrativeTypeInfoOf(city).color }}
                        aria-hidden="true"
                      />
                      {cityName(city.city)}
                    </span>
                    <small>{city.coverage === 1 ? "已有攻略" : "尚未收录"}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="map-list-empty">
          <strong>这片视野里还没有城市点</strong>
          <span>继续移动地图，或者切回全部城市。</span>
          <button type="button" onClick={() => setCityScope("all")}>查看全部城市</button>
        </div>
      )}
    </div>
  );

  const renderPlanner = () => (
    <>
      <div className="panel-titlebar planner-titlebar">
        <div>
          <span className="panel-breadcrumb">全国路线</span>
          <h2>行程规划</h2>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            onClick={togglePanelReadingWidth}
            aria-label={panelExpanded ? "回到地图" : "宽屏规划行程"}
          >
            {panelExpanded ? "回到地图" : "宽屏规划"}
          </button>
          <button
            className="panel-close"
            type="button"
            onClick={() => openHome()}
            aria-label="返回首页"
          >
            ←
          </button>
        </div>
      </div>
      <div className="journey-planner-page">
        <p className="journey-planner-page__intro">
          先选完城市并安排每站天数，生成后再查看跨城顺序和地图连线。
        </p>
        <JourneyPlanner
          cities={planningCities}
          selectedCityIds={journeyCityIds}
          daysByCityId={journeyDaysByCityId}
          startCityId={journeyStartCityId}
          plan={journeyPlan}
          generated={journeyGenerated}
          onToggleCity={toggleJourneyCity}
          onChangeDays={changeJourneyDays}
          onSetStart={setJourneyStart}
          onGenerate={() => setJourneyGenerated(true)}
          onEdit={() => setJourneyGenerated(false)}
          onClear={clearJourney}
        />
      </div>
    </>
  );

  const renderCity = (guide: TravelGuide) => {
    const nearby = nearestGuides(guide.coordinates, 3, guide.id);

    return (
      <>
        <div className="panel-titlebar">
          <div>
            <span className="panel-breadcrumb">中国 / {guide.adminArea}</span>
            <h2>{cityName(guide.city)}</h2>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              onClick={togglePanelReadingWidth}
              aria-label={panelExpanded ? "回到地图" : "宽屏浏览结构化攻略"}
            >
              {panelExpanded ? "回到地图" : "宽屏浏览"}
            </button>
            <button
              className="panel-close"
              type="button"
              onClick={() => openHome()}
              aria-label="返回城市列表"
            >
              ←
            </button>
          </div>
        </div>

        <div className="guide-meta-row">
          <span>已有攻略</span>
          {activeMapCity && <span>{administrativeTypeInfoOf(activeMapCity).label}</span>}
          <span>最近整理 {formatDate(guide.lastResearched)}</span>
        </div>

        <div className="guide-overview">
            <p className="guide-summary">{guide.summary}</p>
            <div className="quick-facts">
              <div>
                <span>建议停留</span>
                <strong>{guide.suggestedStay}</strong>
              </div>
              <div>
                <span>攻略结构</span>
                <strong>8 类主题</strong>
              </div>
            </div>
            <div className="keyword-list" aria-label="旅行关键词">
              {guide.keywords.slice(0, 6).map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>

            {activeGuideMap && (
              <section className="guide-map-toolbar" aria-label="攻略地图联动">
                <div className="guide-map-toolbar__heading">
                  <div>
                    <span>攻略地图</span>
                    <strong>从空间关系理解{cityName(guide.city)}</strong>
                  </div>
                  <small>点击攻略卡片可继续定位</small>
                </div>
                <div className="guide-map-toolbar__modes" role="group" aria-label="地图内容">
                  {([
                    ["overview", "首访"],
                    ["attractions", "景点"],
                    ["itinerary", "线路"],
                    ["food", "美食片区"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={guideMapSelection.mode === mode ? "is-active" : ""}
                      aria-pressed={guideMapSelection.mode === mode}
                      onClick={() => selectGuideMapMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <GuideStructureLoader contentPath={guide.structuredPath}>
              {(sections) => (
                <GuideBrowser
                  key={guide.id}
                  guideId={guide.id}
                  sections={sections}
                  activeMapItemId={guideMapSelection.itemId ?? guideMapSelection.routeId}
                  activeMapItemTitle={guideMapSelection.itemTitle}
                  getMapItemId={activeGuideMap ? resolveGuideMapItemId : undefined}
                  onMapItemSelect={activeGuideMap ? handleGuideMapItemSelect : undefined}
                  onSectionOpen={activeGuideMap ? handleGuideSectionOpen : undefined}
                />
              )}
            </GuideStructureLoader>

            <section className="nearby-guides" aria-labelledby={`${guide.id}-nearby`}>
              <div className="nearby-guides__heading">
                <div>
                  <span>沿着地图继续</span>
                  <strong id={`${guide.id}-nearby`}>附近还可以去</strong>
                </div>
                <small>直线距离</small>
              </div>
              <div className="nearby-guides__list">
                {nearby.map(({ guide: nearbyGuide, distance }) => (
                  <button
                    key={nearbyGuide.id}
                    type="button"
                    onClick={() => openGuide(nearbyGuide)}
                  >
                    <span>
                      <strong>{cityName(nearbyGuide.city)}</strong>
                      <small>{nearbyGuide.adminArea}</small>
                    </span>
                    <em>{formatDistance(distance)}</em>
                  </button>
                ))}
              </div>
            </section>
          </div>
      </>
    );
  };

  const renderMissing = (city: MapCity) => {
    const nearby = nearestGuides(city.coordinates, 3);

    return (
      <>
        <div className="panel-titlebar">
          <div>
            <span className="panel-breadcrumb">中国 / {city.adminArea}</span>
            <h2>{cityName(city.city)}</h2>
          </div>
          <div className="panel-actions">
            <button
              className="panel-close"
              type="button"
              onClick={() => openHome()}
              aria-label="返回城市列表"
            >
              ←
            </button>
          </div>
        </div>

        <div className="guide-meta-row">
          <span className="is-missing">尚未收录</span>
          <span>{administrativeTypeInfoOf(city).label}</span>
        </div>

        <div className="guide-overview missing-guide-overview">
          <p className="guide-summary">
            这座城市的攻略还在路上，先从附近已经整理好的城市继续看看。
          </p>

          <section className="nearby-guides" aria-labelledby={`${city.id}-nearby`}>
            <div className="nearby-guides__heading">
              <div>
                <span>先看看周边</span>
                <strong id={`${city.id}-nearby`}>附近已有攻略</strong>
              </div>
              <small>直线距离</small>
            </div>
            <div className="nearby-guides__list">
              {nearby.map(({ guide, distance }) => (
                <button key={guide.id} type="button" onClick={() => openGuide(guide)}>
                  <span>
                    <strong>{cityName(guide.city)}</strong>
                    <small>{guide.adminArea}</small>
                  </span>
                  <em>{formatDistance(distance)}</em>
                </button>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderNearby = (point: MapPoint) => {
    const nearby = nearestGuides(point, 5);

    return (
      <>
        <div className="panel-titlebar explore-titlebar">
          <div>
            <span className="panel-breadcrumb">地图探索</span>
            <h2>这附近可以去</h2>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              onClick={() => setPanelLayout(panelExpanded ? "docked" : "expanded")}
            >
              {panelExpanded ? "回到地图" : "宽屏查看"}
            </button>
            <button
              className="panel-close"
              type="button"
              onClick={() => openHome()}
              aria-label="返回城市列表"
            >
              ←
            </button>
          </div>
        </div>

        <div className="explore-nearby">
          <div className="explore-nearby__intro">
            <span aria-hidden="true">◎</span>
            <div>
              <strong>从你点的位置出发</strong>
              <p>按直线距离排出了最近的城市攻略，选一座继续沿着地图走。</p>
            </div>
          </div>

          <div className="explore-result-list">
            {nearby.map(({ guide, distance }, index) => (
              <button key={guide.id} type="button" onClick={() => openGuide(guide)}>
                <span className="explore-result-list__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="explore-result-list__city">
                  <strong>{cityName(guide.city)}</strong>
                  <small>{guide.adminArea} · {guide.suggestedStay.split(/[；。]/)[0]}</small>
                </span>
                <em>{formatDistance(distance)}</em>
              </button>
            ))}
          </div>

          <button className="random-explore is-compact" type="button" onClick={exploreRandomGuide}>
            <span className="random-explore__compass" aria-hidden="true">✦</span>
            <span>
              <strong>换个方向</strong>
              <small>随机看看另一座城市</small>
            </span>
            <span className="random-explore__arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className={`travel-app is-panel-${panelLayout}`}>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">游</span>
          <div>
            <h1>旅行地图</h1>
          </div>
          <div className="header-map-actions" aria-label="地图快捷操作">
            <button type="button" onClick={resetToNation}>全国</button>
            <button type="button" onClick={exploreRandomGuide}>随机</button>
          </div>
        </div>
        <form className="city-search" onSubmit={handleSearch} role="search">
          <label className="sr-only" htmlFor="city-search">搜索城市或旅行关键词</label>
          <input
            id="city-search"
            list="city-options"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索城市或关键词"
            autoComplete="off"
          />
          <datalist id="city-options">
            {mapCities.map((city) => (
              <option key={city.id} value={cityName(city.city)} />
            ))}
          </datalist>
          <button type="submit">查找</button>
        </form>
      </header>

      <main className="experience-shell">
        <section className="map-section" aria-label="中国城市攻略地图">
          <TerrainMap
            cities={mapCities}
            activeCityId={activeMapCity?.id}
            highlightedCityIds={panel.kind === "planner" ? journeyCityIds : []}
            preserveViewport={panel.kind === "planner"}
            guideMap={mapGuideMap}
            guideMapSelection={mapGuideSelection}
            panelLayout={panelLayout}
            explorePoint={explorePoint}
            onSelectCity={openMapCity}
            onSelectGuideItem={handleMapGuideItemSelect}
            onExploreNear={openNearby}
            onViewportCitiesChange={updateViewportCities}
            resetSignal={mapResetSignal}
          />
        </section>

        <div className={`panel-dock is-${panelLayout}`}>
          <button
            ref={panelDockToggleRef}
            className="panel-dock-toggle"
            type="button"
            aria-controls="travel-guide-panel"
            aria-expanded={!panelCollapsed}
            aria-label={panelCollapsed ? `展开${panelDockContext}` : "收起攻略栏"}
            onClick={() => setPanelLayout(panelCollapsed ? "docked" : "collapsed")}
          >
            <span className="panel-dock-toggle__arrow" aria-hidden="true">
              {panelCollapsed ? "‹" : "›"}
            </span>
            <strong>{panelCollapsed ? `打开 · ${panelDockContext}` : "收起"}</strong>
          </button>

          <aside
            id="travel-guide-panel"
            className="guide-panel"
            aria-hidden={panelCollapsed}
            inert={panelCollapsed}
          >
            <div className="panel-utility-bar">
              <span>{panelDockContext}</span>
              <button
                type="button"
                onClick={hidePanel}
              >
                隐藏侧栏{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <button
              className="sheet-handle"
              type="button"
              onClick={togglePanelReadingWidth}
              aria-label={panelExpanded ? "回到半屏攻略" : "展开攻略"}
            >
              <span />
            </button>
            <div className="guide-panel-scroll" ref={panelScrollRef}>
              {panel.kind === "home" && renderHome()}
              {panel.kind === "planner" && renderPlanner()}
              {panel.kind === "city" && activeGuide && renderCity(activeGuide)}
              {panel.kind === "missing" && activeMapCity && renderMissing(activeMapCity)}
              {panel.kind === "nearby" && renderNearby(panel)}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
