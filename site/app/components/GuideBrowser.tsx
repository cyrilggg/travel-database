"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GuideBrowseItem, GuideBrowseKey, GuideBrowseSection } from "../generated/publicGuides";
import styles from "./GuideBrowser.module.css";

type GuideBrowserProps = {
  guideId: string;
  sections: readonly GuideBrowseSection[];
  activeMapItemId?: string;
  activeMapItemTitle?: string;
  getMapItemId?: (key: GuideBrowseKey, item: GuideBrowseItem) => string | undefined;
  onMapItemSelect?: (key: GuideBrowseKey, item: GuideBrowseItem, mapItemId: string) => void;
  onSectionOpen?: (key: GuideBrowseKey) => void;
};

function BrowseCard({
  item,
  mapItemId,
  mapActive,
  onMapSelect,
}: {
  item: GuideBrowseItem;
  mapItemId?: string;
  mapActive: boolean;
  onMapSelect?: () => void;
}) {
  return (
    <article
      className={`${styles.card} ${mapActive ? styles.cardMapActive : ""}`}
      data-map-item-id={mapItemId}
      data-map-item-title={item.title}
    >
      {item.badges.length > 0 && (
        <div className={styles.badges} aria-label="条目标签">
          {item.badges.map((badge) => <span key={badge}>{badge}</span>)}
        </div>
      )}
      <div className={styles.cardHeading}>
        <h4>{item.title}</h4>
        {mapItemId && onMapSelect && (
          <button
            type="button"
            className={styles.mapButton}
            aria-pressed={mapActive}
            onClick={onMapSelect}
          >
            {mapActive ? "地图已定位" : "在地图上看"}
          </button>
        )}
      </div>
      {item.description && <p className={styles.description}>{item.description}</p>}
      {item.fields.length > 0 && (
        <dl className={styles.fields}>
          {item.fields.map((entry, index) => (
            <div key={`${entry.label}-${entry.value}-${index}`}>
              <dt>{entry.label}</dt>
              <dd>
                {entry.value && <span>{entry.value}</span>}
                {entry.links && entry.links.length > 0 && (
                  <span className={styles.links}>
                    {entry.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export default function GuideBrowser({
  guideId,
  sections,
  activeMapItemId,
  activeMapItemTitle,
  getMapItemId,
  onMapItemSelect,
  onSectionOpen,
}: GuideBrowserProps) {
  const idPrefix = useId().replace(/:/g, "");
  const browserRef = useRef<HTMLElement>(null);
  const [openKeys, setOpenKeys] = useState<Set<GuideBrowseKey>>(
    () => new Set(sections[0] ? [sections[0].key] : []),
  );

  useEffect(() => {
    if (!activeMapItemId) return;
    window.requestAnimationFrame(() => {
      const candidates = browserRef.current?.querySelectorAll<HTMLElement>(
        `[data-map-item-id="${activeMapItemId}"]`,
      );
      const target = [...(candidates ?? [])].find(
        (candidate) => !activeMapItemTitle || candidate.dataset.mapItemTitle === activeMapItemTitle,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [activeMapItemId, activeMapItemTitle]);

  if (sections.length === 0) {
    return (
      <div className={styles.empty} role="note">
        <strong>这篇攻略暂时没有可提取的重点卡片</strong>
        <span>这座城市目前只有地图摘要，结构化内容仍待补充。</span>
      </div>
    );
  }

  return (
    <section
      ref={browserRef}
      className={styles.browser}
      aria-labelledby={`${idPrefix}-${guideId}-browser-title`}
    >
      <div className={styles.browserActions}>
        <h3 className="sr-only" id={`${idPrefix}-${guideId}-browser-title`}>城市攻略</h3>
        <button
          type="button"
          className={styles.expandAll}
          onClick={() => setOpenKeys(openKeys.size === sections.length ? new Set() : new Set(sections.map((section) => section.key)))}
        >
          {openKeys.size === sections.length ? "全部收起" : "全部展开"}
        </button>
      </div>

      <div className={styles.accordion}>
        {sections.map((section, index) => {
          const isOpen = openKeys.has(section.key);
          const buttonId = `${idPrefix}-${guideId}-${section.key}-button`;
          const panelId = `${idPrefix}-${guideId}-${section.key}-panel`;

          return (
            <section className={`${styles.topic} ${isOpen ? styles.topicOpen : ""}`} key={section.key}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenKeys((current) => {
                    const next = new Set(current);
                    if (isOpen) {
                      next.delete(section.key);
                    } else {
                      next.add(section.key);
                      onSectionOpen?.(section.key);
                    }
                    return next;
                  })}
                >
                  <span className={styles.topicIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.topicTitle}>
                    <strong>{section.label}</strong>
                    <small>{section.hint}</small>
                  </span>
                  <span className={styles.topicCount}>{section.totalCount} 条</span>
                  <span className={styles.topicToggle} aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
              </h3>

              <div
                id={panelId}
                className={styles.topicPanel}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
              >
                <div className={styles.sourceLine}>
                  <span>摘自「{section.sourceTitle}」</span>
                  <span>共 {section.totalCount} 条</span>
                </div>
                <div className={styles.cards}>
                  {section.items.map((item) => {
                    const mapItemId = getMapItemId?.(section.key, item);
                    return (
                      <BrowseCard
                        key={item.id}
                        item={item}
                        mapItemId={mapItemId}
                        mapActive={Boolean(
                          mapItemId &&
                          mapItemId === activeMapItemId &&
                          (!activeMapItemTitle || item.title === activeMapItemTitle),
                        )}
                        onMapSelect={mapItemId && onMapItemSelect
                          ? () => onMapItemSelect(section.key, item, mapItemId)
                          : undefined}
                      />
                    );
                  })}
                </div>
                <div className={styles.topicFooter}>
                  <span>当前主题的结构化要点已全部展示</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
