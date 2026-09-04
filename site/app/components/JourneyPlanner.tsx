"use client";

import { useMemo, useState } from "react";
import type { MapCity } from "../generated/publicGuides";
import type { JourneyPlan } from "./journeyPlannerLogic";

type JourneyPlannerProps = {
  cities: MapCity[];
  selectedCityIds: string[];
  daysByCityId: Record<string, number>;
  startCityId?: string;
  plan: JourneyPlan;
  onToggleCity: (cityId: string) => void;
  onChangeDays: (cityId: string, days: number) => void;
  onSetStart: (cityId: string) => void;
  onClear: () => void;
};

const shortCityName = (name: string) => name.replace(/[市区]$/, "");
const formatDistance = (distance: number) => `直线约 ${Math.max(1, Math.round(distance / 10) * 10)} km`;

export default function JourneyPlanner({
  cities,
  selectedCityIds,
  daysByCityId,
  startCityId,
  plan,
  onToggleCity,
  onChangeDays,
  onSetStart,
  onClear,
}: JourneyPlannerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const selectedSet = useMemo(() => new Set(selectedCityIds), [selectedCityIds]);
  const matches = useMemo(
    () => normalizedQuery
      ? cities
          .filter((city) =>
            `${city.city}${city.adminArea}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
          )
          .slice(0, 12)
      : [],
    [cities, normalizedQuery],
  );

  const selectCity = (cityId: string) => {
    onToggleCity(cityId);
    setQuery("");
  };

  return (
    <div className="journey-planner">
      <div className="journey-planner__search">
        <label htmlFor="journey-city-search">选择目的地</label>
        <span>可搜索全国已收录城市，也可直接点击地图</span>
        <div>
          <input
            id="journey-city-search"
            type="search"
            value={query}
            placeholder="输入城市或省份"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          <strong>{selectedCityIds.length} 站</strong>
        </div>
        {normalizedQuery && (
          <div className="journey-planner__matches" aria-label="目的地搜索结果">
            {matches.length > 0 ? matches.map((city) => {
              const selected = selectedSet.has(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  aria-pressed={selected}
                  onClick={() => selectCity(city.id)}
                >
                  <span><strong>{shortCityName(city.city)}</strong><small>{city.adminArea}</small></span>
                  <i aria-hidden="true">{selected ? "✓" : "+"}</i>
                </button>
              );
            }) : <p>换一个城市名称继续搜索。</p>}
          </div>
        )}
      </div>

      <div className="journey-planner__heading">
        <div>
          <strong>跨城路线</strong>
          <span>选择起点并分配停留天数，路线按地理邻近排列</span>
        </div>
        {selectedCityIds.length > 0 && <button type="button" onClick={onClear}>清空</button>}
      </div>

      {plan.stops.length === 0 ? (
        <div className="journey-planner__empty">从搜索或地图中选择城市，路线会在这里依次展开。</div>
      ) : (
        <div className="journey-planner__route">
          {plan.stops.map((stop, index) => {
            const activeStart = stop.city.id === (startCityId ?? plan.stops[0]?.city.id);
            const days = daysByCityId[stop.city.id] ?? 1;
            return (
              <article key={stop.city.id} className={activeStart ? "is-start" : ""}>
                {index > 0 && (
                  <div className="journey-planner__transfer">
                    <span aria-hidden="true">↓</span>
                    <small>{formatDistance(stop.distanceFromPrevious)}</small>
                  </div>
                )}
                <div className="journey-planner__stop">
                  <span className="journey-planner__order">{index + 1}</span>
                  <div className="journey-planner__city">
                    <strong>{shortCityName(stop.city.city)}</strong>
                    <small>{stop.city.adminArea} · 第 {stop.dayStart}{stop.dayEnd > stop.dayStart ? `–${stop.dayEnd}` : ""} 天</small>
                  </div>
                  <div className="journey-planner__days" aria-label={`${shortCityName(stop.city.city)}停留天数`}>
                    <button type="button" aria-label="减少一天" onClick={() => onChangeDays(stop.city.id, days - 1)}>−</button>
                    <strong>{days} 天</strong>
                    <button type="button" aria-label="增加一天" onClick={() => onChangeDays(stop.city.id, days + 1)}>+</button>
                  </div>
                  <div className="journey-planner__stop-actions">
                    <button
                      type="button"
                      className={activeStart ? "is-active" : ""}
                      onClick={() => onSetStart(stop.city.id)}
                    >
                      {activeStart ? "起点" : "设为起点"}
                    </button>
                    <button type="button" onClick={() => onToggleCity(stop.city.id)}>移除</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {plan.stops.length > 0 && (
        <div className="journey-planner__summary" aria-live="polite">
          <span><strong>{plan.stops.length}</strong> 座城市</span>
          <span><strong>{plan.totalDays}</strong> 天</span>
          {plan.stops.length > 1 && <span>直线串联约 <strong>{Math.max(1, Math.round(plan.totalDistance / 10) * 10)}</strong> km</span>}
        </div>
      )}
    </div>
  );
}
