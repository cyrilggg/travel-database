"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import GuideBrowser from "./GuideBrowser";
import GuideContentLoader from "./GuideContentLoader";
import TerrainMap from "./TerrainMap";
import { guides, type TravelGuide } from "../generated/guides";

type PanelState =
  | { kind: "home" }
  | { kind: "city"; guideId: string }
  | { kind: "nearby"; longitude: number; latitude: number };

type PanelLayout = "collapsed" | "docked" | "expanded";

type MapPoint = {
  longitude: number;
  latitude: number;
};

const cityName = (name: string) => name.replace(/[市区]$/, "");

const formatDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
};

const statusLabel = (guide: TravelGuide) =>
  guide.completeness === "partial" ? "内容待补全" : "资料已整理";

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
  guides
    .filter((guide) => guide.id !== excludedGuideId)
    .map((guide) => ({
      guide,
      distance: distanceInKilometers(point, guide.coordinates),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

export default function TravelMap() {
  const [panel, setPanel] = useState<PanelState>({ kind: "home" });
  const [readingMode, setReadingMode] = useState<"overview" | "full">(
    "overview",
  );
  const [panelLayout, setPanelLayout] = useState<PanelLayout>("docked");
  const [searchQuery, setSearchQuery] = useState("");
  const [guideScope, setGuideScope] = useState<"viewport" | "all">("viewport");
  const [viewportGuideIds, setViewportGuideIds] = useState<string[]>(() =>
    guides.map((guide) => guide.id),
  );
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelDockToggleRef = useRef<HTMLButtonElement>(null);
  const overviewTabRef = useRef<HTMLButtonElement>(null);
  const fullReadingTabRef = useRef<HTMLButtonElement>(null);
  const previousReadingModeRef = useRef(readingMode);

  const panelExpanded = panelLayout === "expanded";
  const panelCollapsed = panelLayout === "collapsed";
  const viewportGuideIdSet = useMemo(() => new Set(viewportGuideIds), [viewportGuideIds]);
  const listedGuides = useMemo(
    () =>
      guideScope === "viewport"
        ? guides.filter((guide) => viewportGuideIdSet.has(guide.id))
        : guides,
    [guideScope, viewportGuideIdSet],
  );

  const sortedGuides = useMemo(
    () =>
      [...listedGuides].sort(
        (a, b) =>
          a.adminArea.localeCompare(b.adminArea, "zh-CN") ||
          a.city.localeCompare(b.city, "zh-CN"),
      ),
    [listedGuides],
  );

  const guideGroups = useMemo(() => {
    const groups = new Map<string, TravelGuide[]>();
    sortedGuides.forEach((guide) => {
      const group = groups.get(guide.adminArea) ?? [];
      group.push(guide);
      groups.set(guide.adminArea, group);
    });
    return [...groups.entries()];
  }, [sortedGuides]);

  const activeGuide =
    panel.kind === "city"
      ? guides.find((guide) => guide.id === panel.guideId)
      : undefined;

  const explorePoint =
    panel.kind === "nearby"
      ? { longitude: panel.longitude, latitude: panel.latitude }
      : undefined;

  const panelDockContext =
    activeGuide
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
  }, [panel, readingMode]);

  useEffect(() => {
    if (panelCollapsed) {
      panelDockToggleRef.current?.focus({ preventScroll: true });
    }
  }, [panelCollapsed]);

  useEffect(() => {
    if (previousReadingModeRef.current === readingMode) return;
    previousReadingModeRef.current = readingMode;
    const target = readingMode === "full" ? fullReadingTabRef : overviewTabRef;
    target.current?.focus({ preventScroll: true });
  }, [readingMode]);

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
        if (readingMode === "full") {
          setReadingMode("overview");
          setPanelLayout("docked");
          return;
        }
        setPanelLayout((layout) =>
          layout === "expanded" ? "docked" : "collapsed",
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readingMode]);

  const openGuide = (guide: TravelGuide) => {
    setPanel({ kind: "city", guideId: guide.id });
    setReadingMode("overview");
    setPanelLayout("docked");
  };

  const openHome = (scope?: "viewport" | "all") => {
    setPanel({ kind: "home" });
    setReadingMode("overview");
    setPanelLayout("docked");
    if (scope) setGuideScope(scope);
  };

  const openNearby = (point: MapPoint) => {
    setPanel({ kind: "nearby", ...point });
    setReadingMode("overview");
    setPanelLayout("docked");
  };

  const openFullReading = () => {
    setReadingMode("full");
    setPanelLayout("expanded");
  };

  const openOverview = () => {
    setReadingMode("overview");
    setPanelLayout("docked");
  };

  const togglePanelReadingWidth = () => {
    if (readingMode === "full") {
      openOverview();
      return;
    }
    setPanelLayout(panelExpanded ? "docked" : "expanded");
  };

  const hidePanel = () => {
    setPanelLayout("collapsed");
  };

  const exploreRandomGuide = () => {
    const scopedGuides = listedGuides.length > 0 ? listedGuides : guides;
    const candidates = activeGuide
      ? scopedGuides.filter((guide) => guide.id !== activeGuide.id)
      : scopedGuides;
    const pool = candidates.length > 0 ? candidates : guides;
    const guide = pool[Math.floor(Math.random() * pool.length)];
    openGuide(guide);
  };

  const updateViewportGuides = (ids: string[]) => {
    setViewportGuideIds((current) => {
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

    const match = guides.find((guide) =>
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
        拖动或缩放地图，城市目录会跟着当前视野变化。也可以点击地图上的任意位置，看看附近有哪些攻略。
      </p>

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
            className={guideScope === "viewport" ? "is-active" : ""}
            onClick={() => setGuideScope("viewport")}
          >
            当前地图
          </button>
          <button
            type="button"
            className={guideScope === "all" ? "is-active" : ""}
            onClick={() => setGuideScope("all")}
          >
            全部城市
          </button>
        </div>
        <span className="map-status-dot" aria-live="polite">
          {guideScope === "viewport" ? "跟随地图" : "完整目录"}
        </span>
      </div>

      <div className="panel-section-heading">
        <div>
          <span>{guideScope === "viewport" ? "当前视野" : "城市目录"}</span>
          <small>{guideScope === "viewport" ? "拖动地图即可更新" : "按省份浏览"}</small>
        </div>
      </div>

      {guideGroups.length > 0 ? (
        <div className="province-city-groups">
          {guideGroups.map(([adminArea, areaGuides]) => (
            <section className="province-city-group" key={adminArea}>
              <h3>{adminArea}</h3>
              <div className="city-index">
                {areaGuides.map((guide) => (
                  <button key={guide.id} type="button" onClick={() => openGuide(guide)}>
                    <span>{cityName(guide.city)}</span>
                    <small>{guide.suggestedStay.split(/[；。]/)[0]}</small>
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
          <button type="button" onClick={() => setGuideScope("all")}>查看全部城市</button>
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
              aria-label={
                readingMode === "full" || panelExpanded
                  ? "回到地图与攻略重点"
                  : "宽屏浏览攻略重点"
              }
            >
              {readingMode === "full" || panelExpanded ? "回到地图" : "宽屏浏览"}
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
          <span className={guide.completeness === "partial" ? "is-partial" : ""}>
            {statusLabel(guide)}
          </span>
          <span>最近整理 {formatDate(guide.lastResearched)}</span>
        </div>

        <nav className="reading-tabs" aria-label="攻略阅读模式">
          <button
            ref={overviewTabRef}
            type="button"
            className={readingMode === "overview" ? "is-active" : ""}
            aria-pressed={readingMode === "overview"}
            onClick={openOverview}
          >
            攻略重点
          </button>
          <button
            ref={fullReadingTabRef}
            type="button"
            className={readingMode === "full" ? "is-active" : ""}
            aria-pressed={readingMode === "full"}
            onClick={openFullReading}
          >
            完整攻略
          </button>
        </nav>

        {readingMode === "overview" ? (
          <div className="guide-overview">
            <p className="guide-summary">{guide.summary}</p>
            <div className="quick-facts">
              <div>
                <span>建议停留</span>
                <strong>{guide.suggestedStay}</strong>
              </div>
              <div>
                <span>攻略结构</span>
                <strong>{guide.sections.filter((section) => section.level === 2).length} 个主题</strong>
              </div>
            </div>
            <div className="keyword-list" aria-label="旅行关键词">
              {guide.keywords.slice(0, 6).map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>

            <GuideContentLoader
              contentPath={guide.markdownPath}
              loadingLabel="正在整理攻略重点"
            >
              {(markdown) => (
                <GuideBrowser
                  key={guide.id}
                  guideId={guide.id}
                  markdown={markdown}
                  sections={guide.sections}
                  onOpenFullGuide={openFullReading}
                />
              )}
            </GuideContentLoader>

            <button
              className="read-full-button"
              type="button"
              onClick={openFullReading}
            >
              打开完整攻略 <span aria-hidden="true">→</span>
            </button>

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
        ) : (
          <div className="full-guide-wrap">
            {guide.completeness === "partial" && (
              <div className="partial-notice">
                这篇攻略目前只有速览与城市格局，后续章节仍待补充。
              </div>
            )}
            <GuideContentLoader contentPath={guide.markdownPath} />
            <p className="source-path">源文件：{guide.sourcePath}</p>
          </div>
        )}
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
            <p>分级地形 · 城市攻略</p>
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
            {guides.map((guide) => (
              <option key={guide.id} value={cityName(guide.city)} />
            ))}
          </datalist>
          <button type="submit">查找</button>
        </form>
        <button
          className="all-cities-button"
          type="button"
          onClick={() => openHome("all")}
        >
          城市列表
        </button>
      </header>

      <main className="experience-shell">
        <section className="map-section" aria-label="中国城市攻略地图">
          <TerrainMap
            guides={guides}
            activeGuideId={activeGuide?.id}
            showItineraryRoute={false}
            itineraryActive={false}
            panelLayout={panelLayout}
            explorePoint={explorePoint}
            onSelectGuide={openGuide}
            onExploreNear={openNearby}
            onExploreRandom={exploreRandomGuide}
            onViewportGuidesChange={updateViewportGuides}
            onReset={() => openHome("viewport")}
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
                onClick={readingMode === "full" ? openOverview : hidePanel}
              >
                {readingMode === "full" ? "回到地图与重点" : "隐藏侧栏"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <button
              className="sheet-handle"
              type="button"
              onClick={togglePanelReadingWidth}
              aria-label={
                readingMode === "full"
                  ? "回到地图与攻略重点"
                  : panelExpanded
                    ? "回到半屏攻略"
                    : "展开攻略"
              }
            >
              <span />
            </button>
            <div className="guide-panel-scroll" ref={panelScrollRef}>
              {panel.kind === "home" && renderHome()}
              {panel.kind === "city" && activeGuide && renderCity(activeGuide)}
              {panel.kind === "nearby" && renderNearby(panel)}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
