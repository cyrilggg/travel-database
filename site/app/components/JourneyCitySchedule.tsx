"use client";

import { useEffect, useState } from "react";
import {
  guides,
  type GuideBrowseItem,
  type GuideBrowseSection,
  type MapCity,
} from "../generated/publicGuides";

type DayRoute = {
  title: string;
  stops: string[];
};

const guidePathById = new Map(guides.map((guide) => [guide.id, guide.structuredPath]));
const durationPatterns: Record<number, RegExp> = {
  1: /(?:一日|1\s*天|1日)/,
  2: /(?:两日|二日|2\s*天|2日)/,
  3: /(?:三日|3\s*天|3日)/,
  4: /(?:四日|4\s*天|4日)/,
  5: /(?:五日|5\s*天|5日)/,
  6: /(?:六日|6\s*天|6日)/,
  7: /(?:七日|7\s*天|7日)/,
};
const specialRoutePattern = /雨天|亲子|低体力|无障碍|夜间|冬季|替代/;

function resolveContentUrl(path: string) {
  if (typeof document === "undefined") return path;
  return new URL(path.replace(/^\/+/, ""), document.baseURI).toString();
}

function routeText(item: GuideBrowseItem) {
  const description = item.description?.trim() ?? "";
  const routeMatch = description.match(/路线[：:]\s*([^。]+)/);
  return (routeMatch?.[1] ?? description.split("。")[0] ?? "").trim();
}

function splitStops(value: string) {
  return value
    .replace(/^第\s*[一二三四五六七八九十\d]+\s*天(?:（[^）]+）|\([^)]*\))?[：:]\s*/, "")
    .split(/\s*(?:→|—|->|＞)\s*/)
    .map((stop) => stop.trim().replace(/^(?:路线|次日)[：:]?\s*/, ""))
    .filter(Boolean);
}

function evenlyDistribute(stops: string[], days: number, title: string): DayRoute[] {
  if (stops.length < days) return [];
  return Array.from({ length: days }, (_, index) => {
    const start = Math.floor((index * stops.length) / days);
    const end = Math.floor(((index + 1) * stops.length) / days);
    return {
      title,
      stops: stops.slice(start, Math.max(start + 1, end)),
    };
  });
}

function parseExactRoute(item: GuideBrowseItem, days: number): DayRoute[] {
  const text = routeText(item);
  const explicitDays = [...text.matchAll(
    /第\s*([一二三四五六七八九十\d]+)\s*天(?:（[^）]+）|\([^)]*\))?[：:]\s*([^；;]+)(?=；|;|$)/g,
  )];
  if (explicitDays.length > 0) {
    return explicitDays.slice(0, days).map((match) => ({
      title: item.title,
      stops: splitStops(match[2]),
    }));
  }

  if (days === 2 && /次日/.test(text)) {
    return text.split(/次日[：:]?\s*/).slice(0, 2).map((part) => ({
      title: item.title,
      stops: splitStops(part),
    }));
  }

  return evenlyDistribute(splitStops(text), days, item.title);
}

function buildDailyRoutes(sections: GuideBrowseSection[], days: number): DayRoute[] {
  const itinerary = sections.find((section) => section.key === "itinerary");
  const attractions = sections.find((section) => section.key === "attractions")?.items ?? [];
  const items = itinerary?.items ?? [];
  const boundedDays = Math.max(1, Math.min(14, days));
  const durationPattern = durationPatterns[boundedDays];
  const exact = durationPattern
    ? items.find((item) => durationPattern.test(item.title) && !specialRoutePattern.test(item.title))
    : undefined;

  if (exact) {
    const routes = parseExactRoute(exact, boundedDays);
    if (routes.length === boundedDays && routes.every((route) => route.stops.length > 0)) {
      return routes;
    }
  }

  const themedRoutes = items.filter((item) =>
    !specialRoutePattern.test(item.title) &&
    !Object.values(durationPatterns).some((pattern) => pattern.test(item.title)) &&
    splitStops(routeText(item)).length > 0,
  );
  const routes = themedRoutes.slice(0, boundedDays).map((item) => ({
    title: item.title,
    stops: splitStops(routeText(item)),
  }));

  const usedStops = new Set(routes.flatMap((route) => route.stops));
  const remainingAttractions = attractions
    .map((item) => item.title)
    .filter((title) => !usedStops.has(title));
  const themedRouteCount = routes.length;
  while (routes.length < boundedDays) {
    const fallbackIndex = routes.length - themedRouteCount;
    const start = fallbackIndex * 3;
    const fallbackStops = remainingAttractions.slice(start, start + 3);
    routes.push({
      title: "经典景点组合",
      stops: fallbackStops.length > 0 ? fallbackStops : ["按当天开放情况从主要景点中选择"],
    });
  }

  return routes;
}

export default function JourneyCitySchedule({
  city,
  days,
  dayStart,
}: {
  city: MapCity;
  days: number;
  dayStart: number;
}) {
  const contentPath = city.guideId ? guidePathById.get(city.guideId) : undefined;
  const [state, setState] = useState<{
    routes: DayRoute[];
    loading: boolean;
    failed: boolean;
  }>({ routes: [], loading: true, failed: false });

  useEffect(() => {
    if (!contentPath) return;
    const controller = new AbortController();
    fetch(resolveContentUrl(contentPath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Structure request failed: ${response.status}`);
        return response.json() as Promise<GuideBrowseSection[]>;
      })
      .then((sections) => {
        setState({ routes: buildDailyRoutes(sections, days), loading: false, failed: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ routes: [], loading: false, failed: true });
      });
    return () => controller.abort();
  }, [contentPath, days]);

  if (!contentPath) {
    return <p className="journey-city-schedule__state">城市攻略路线正在准备中。</p>;
  }

  if (state.loading) {
    return (
      <div className="journey-city-schedule__loading" aria-label="正在整理每日路线">
        <span />
        <span />
      </div>
    );
  }
  if (state.failed) {
    return <p className="journey-city-schedule__state">城市攻略路线正在准备中。</p>;
  }

  return (
    <div className="journey-city-schedule" aria-label={`${city.city}每日路线`}>
      {state.routes.map((route, index) => (
        <section className="journey-day-card" key={`${city.id}-${index}`}>
          <div className="journey-day-card__number" aria-label={`第 ${dayStart + index} 天`}>
            <span>第</span>
            <strong>{String(dayStart + index).padStart(2, "0")}</strong>
            <small>天</small>
          </div>
          <div className="journey-day-card__content">
            <div className="journey-day-card__heading">
              <strong>{route.title}</strong>
              <span>{city.city.replace(/[市区]$/, "")}第 {index + 1} 天</span>
            </div>
            <ol>
              {route.stops.map((stop, stopIndex) => (
                <li key={`${stop}-${stopIndex}`}>
                  <span aria-hidden="true" />
                  <strong>{stop}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}
