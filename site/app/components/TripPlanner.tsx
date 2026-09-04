"use client";

import type { GuideMapPlace } from "./guideMapData";
import type { TripPlanDay } from "./tripPlannerLogic";

type TripPlannerProps = {
  places: GuideMapPlace[];
  selectedIds: string[];
  dayCount: number;
  plans: TripPlanDay[];
  activeRouteId?: string;
  onTogglePlace: (placeId: string) => void;
  onDayCountChange: (dayCount: number) => void;
  onActivateDay: (routeId: string) => void;
  onClear: () => void;
};

const formatDistance = (distance: number) =>
  distance < 1 ? `${Math.max(100, Math.round(distance * 1000 / 100) * 100)} 米` : `${distance.toFixed(1)} km`;

export default function TripPlanner({
  places,
  selectedIds,
  dayCount,
  plans,
  activeRouteId,
  onTogglePlace,
  onDayCountChange,
  onActivateDay,
  onClear,
}: TripPlannerProps) {
  const selectedSet = new Set(selectedIds);

  return (
    <section className="trip-planner" aria-labelledby="trip-planner-title">
      <div className="trip-planner__title">
        <div>
          <span>自选路线</span>
          <strong id="trip-planner-title">选好地点，地图自动分日</strong>
        </div>
        {selectedIds.length > 0 && <button type="button" onClick={onClear}>清空</button>}
      </div>

      <div className="trip-planner__step">
        <div className="trip-planner__step-heading">
          <strong><i>1</i> 选择景点</strong>
          <span>已选 {selectedIds.length} 个</span>
        </div>
        <div className="trip-planner__places" aria-label="选择行程景点">
          {places.map((place) => {
            const selected = selectedSet.has(place.id);
            return (
              <button
                key={place.id}
                type="button"
                className={selected ? "is-selected" : ""}
                aria-pressed={selected}
                onClick={() => onTogglePlace(place.id)}
              >
                <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                {place.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="trip-planner__step trip-planner__days-control">
        <div className="trip-planner__step-heading">
          <strong><i>2</i> 安排天数</strong>
          <span>每天就近成组</span>
        </div>
        <div className="trip-planner__day-options" role="group" aria-label="行程天数">
          {[1, 2, 3, 4, 5].map((days) => (
            <button
              key={days}
              type="button"
              className={dayCount === days ? "is-selected" : ""}
              aria-pressed={dayCount === days}
              onClick={() => onDayCountChange(days)}
            >
              {days} 天
            </button>
          ))}
        </div>
      </div>

      <div className="trip-planner__result" aria-live="polite">
        <div className="trip-planner__step-heading">
          <strong><i>3</i> 每日路线</strong>
          {plans.length > 0 && <span>{plans.length} 天 · {selectedIds.length} 个景点</span>}
        </div>
        {selectedIds.length < 2 ? (
          <p>选择至少 2 个景点后，这里会排出每天的游览顺序。</p>
        ) : (
          <div className="trip-planner__routes">
            {plans.map((plan) => (
              <button
                key={plan.route.id}
                type="button"
                className={activeRouteId === plan.route.id ? "is-active" : ""}
                onClick={() => onActivateDay(plan.route.id)}
              >
                <span className="trip-planner__route-day">{plan.route.title}</span>
                <strong>{plan.places.map((place) => place.name).join(" → ")}</strong>
                <small>{plan.places.length} 站 · 地图串联约 {formatDistance(plan.distanceKilometers)}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
