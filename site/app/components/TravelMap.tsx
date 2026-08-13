"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import GuideBrowser from "./GuideBrowser";
import GuideStructureLoader from "./GuideStructureLoader";
import TerrainMap from "./TerrainMap";
import {
  coveredCityCount,
  guides,
  mapCities,
  targetCityCount,
  type MapCity,
  type TravelGuide,
} from "../generated/publicGuides";

type PanelState =
  | { kind: "home" }
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

  const explorePoint =
    panel.kind === "nearby"
      ? { longitude: panel.longitude, latitude: panel.latitude }
      : undefined;

  const panelDockContext =
    activeMapCity
      ? `${cityName(activeMapCity.city)} · ${activeMapCity.coverage === 1 ? "已有攻略" : "尚未收录"}`
      : activeGuide
      ? `${cityName(activeGuide.city)}攻略`
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
  };

  const openMapCity = (city: MapCity) => {
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

  const openNearby = (point: MapPoint) => {
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

  const renderHome = () => (
    <div className="panel-home">
      <p className="panel-eyebrow">旅行地图</p>
      <h2>从一座城市开始</h2>
      <p className="panel-intro">
        朱砂色表示已有单城市攻略，绿色表示尚未收录。拖动或缩放地图，目录会跟着当前视野变化。
      </p>

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
                    <span>{cityName(city.city)}</span>
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

            <GuideStructureLoader contentPath={guide.structuredPath}>
              {(sections) => (
                <GuideBrowser
                  key={guide.id}
                  guideId={guide.id}
                  sections={sections}
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
            showItineraryRoute={false}
            itineraryActive={false}
            panelLayout={panelLayout}
            explorePoint={explorePoint}
            onSelectCity={openMapCity}
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
