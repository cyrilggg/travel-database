"use client";

import { useMemo, useState } from "react";
import type { MapCity } from "../generated/publicGuides";
import JourneyCitySchedule from "./JourneyCitySchedule";
import type { JourneyPlan } from "./journeyPlannerLogic";

type JourneyPlannerProps = {
  cities: MapCity[];
  selectedCityIds: string[];
  daysByCityId: Record<string, number>;
  startCityId?: string;
  plan: JourneyPlan;
  generated: boolean;
  onToggleCity: (cityId: string) => void;
  onChangeDays: (cityId: string, days: number) => void;
  onSetStart: (cityId: string) => void;
  onGenerate: () => void;
  onEdit: () => void;
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
  generated,
  onToggleCity,
  onChangeDays,
  onSetStart,
  onGenerate,
  onEdit,
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
  const selectedCities = useMemo(
    () => selectedCityIds.flatMap((cityId) => {
      const city = cities.find((candidate) => candidate.id === cityId);
      return city ? [city] : [];
    }),
    [cities, selectedCityIds],
  );
  const selectedDays = selectedCities.reduce(
    (total, city) => total + (daysByCityId[city.id] ?? 1),
    0,
  );

  const selectCity = (cityId: string) => {
    onToggleCity(cityId);
    setQuery("");
  };

  return (
    <div className="journey-planner">
      {!generated && (
        <div className="journey-planner__search">
          <label htmlFor="journey-city-search">选择目的地</label>
          <span>搜索全国已收录城市，或移动地图后直接点选</span>
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
      )}

      <div className="journey-planner__heading">
        <div>
          <strong>{generated ? "行程总览" : "已选目的地"}</strong>
          <span>
            {generated
              ? "跨城顺序与每日路线已汇集完成"
              : "安排每站天数并指定起点，选完后统一生成路线"}
          </span>
        </div>
        {generated
          ? <button type="button" onClick={onEdit}>调整行程</button>
          : selectedCityIds.length > 0 && <button type="button" onClick={onClear}>清空</button>}
      </div>

      {!generated && selectedCities.length === 0 && (
        <div className="journey-planner__empty">从搜索或地图中选择城市，已选目的地会汇集在这里。</div>
      )}

      {!generated && selectedCities.length > 0 && (
        <div className="journey-planner__selection">
          {selectedCities.map((city, index) => {
            const activeStart = city.id === (startCityId ?? selectedCities[0]?.id);
            const days = daysByCityId[city.id] ?? 1;
            return (
              <article key={city.id} className={activeStart ? "is-start" : ""}>
                <div className="journey-planner__stop">
                  <span className="journey-planner__order">{index + 1}</span>
                  <div className="journey-planner__city">
                    <strong>{shortCityName(city.city)}</strong>
                    <small>{city.adminArea}</small>
                  </div>
                  <div className="journey-planner__days" aria-label={`${shortCityName(city.city)}停留天数`}>
                    <button type="button" aria-label="减少一天" onClick={() => onChangeDays(city.id, days - 1)}>−</button>
                    <strong>{days} 天</strong>
                    <button type="button" aria-label="增加一天" onClick={() => onChangeDays(city.id, days + 1)}>+</button>
                  </div>
                  <div className="journey-planner__stop-actions">
                    <button
                      type="button"
                      className={activeStart ? "is-active" : ""}
                      onClick={() => onSetStart(city.id)}
                    >
                      {activeStart ? "起点" : "设为起点"}
                    </button>
                    <button type="button" onClick={() => onToggleCity(city.id)}>移除</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {generated && plan.stops.length > 0 && (
        <section className="journey-plan-cover" aria-label="行程摘要">
          <div className="journey-plan-cover__eyebrow">
            <span>跨城行程</span>
            <small>按地理邻近排列</small>
          </div>
          <h3>{plan.stops.map((stop) => shortCityName(stop.city.city)).join(" → ")}</h3>
          <div className="journey-plan-cover__stats">
            <span><strong>{plan.totalDays}</strong><small>天</small></span>
            <span><strong>{plan.stops.length}</strong><small>座城市</small></span>
            <span>
              <strong>{Math.max(1, Math.round(plan.totalDistance / 10) * 10)}</strong>
              <small>公里直线串联</small>
            </span>
          </div>
        </section>
      )}

      {generated && (
        <div className="journey-planner__route">
          {plan.stops.map((stop, index) => {
            const activeStart = stop.city.id === (startCityId ?? plan.stops[0]?.city.id);
            return (
              <article
                key={stop.city.id}
                className={`journey-planner__city-leg${activeStart ? " is-start" : ""}`}
              >
                {index > 0 && (
                  <div className="journey-planner__transfer">
                    <span aria-hidden="true" />
                    <strong>前往 {shortCityName(stop.city.city)}</strong>
                    <small>{formatDistance(stop.distanceFromPrevious)}</small>
                  </div>
                )}
                <header className="journey-planner__city-header">
                  <span className="journey-planner__city-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="journey-planner__city-title">
                    <span>{stop.city.adminArea}{activeStart ? " · 起点" : ""}</span>
                    <h3>{shortCityName(stop.city.city)}</h3>
                  </div>
                  <div className="journey-planner__city-meta">
                    <strong>{stop.days} 天</strong>
                    <small>总行程第 {stop.dayStart}{stop.dayEnd > stop.dayStart ? `–${stop.dayEnd}` : ""} 天</small>
                  </div>
                </header>
                <JourneyCitySchedule
                  city={stop.city}
                  days={stop.days}
                  dayStart={stop.dayStart}
                />
              </article>
            );
          })}
        </div>
      )}

      {!generated && (
        <div className="journey-planner__generate">
          <span>{selectedCities.length} 座城市 · 共 {selectedDays} 天</span>
          <button type="button" disabled={selectedCities.length < 2} onClick={onGenerate}>
            生成路线
          </button>
          {selectedCities.length < 2 && <small>再选择一座城市，即可生成跨城路线。</small>}
        </div>
      )}
    </div>
  );
}
