"use client";

import { useId, useMemo, useState } from "react";
import type { GuideSection } from "../generated/guides";
import {
  parseGuideBrowse,
  type GuideBrowseItem,
  type GuideBrowseKey,
  type GuideBrowseSection,
} from "./guideBrowse";
import styles from "./GuideBrowser.module.css";

type GuideBrowserProps = {
  guideId: string;
  markdown: string;
  sections: readonly GuideSection[];
  onOpenFullGuide: () => void;
};

const DISPLAY_LIMITS: Record<GuideBrowseKey, number> = {
  overview: 6,
  regions: 5,
  attractions: 6,
  food: 5,
  itinerary: 6,
  stay: 5,
  transport: 5,
  checklist: 6,
};

const ITINERARY_BUCKETS = [
  /一日|1日/,
  /两日|二日|2日/,
  /三日|3日|深度/,
  /雨|雪|高温|天气|冬季|夏季/,
  /亲子|低体力|长者|无障碍/,
  /远郊|县域|跨县|跨城|一日游/,
];

function representativeItineraries(items: GuideBrowseItem[], limit: number): GuideBrowseItem[] {
  if (items.length <= limit) return items;
  const picked = new Set<number>();

  for (const bucket of ITINERARY_BUCKETS) {
    const index = items.findIndex((item, itemIndex) => !picked.has(itemIndex) && bucket.test(item.title));
    if (index >= 0) picked.add(index);
    if (picked.size >= limit) break;
  }

  for (let index = 0; index < items.length && picked.size < limit; index += 1) {
    picked.add(index);
  }

  return [...picked]
    .sort((left, right) => left - right)
    .map((index) => items[index]);
}

function representativeAttractions(items: GuideBrowseItem[], limit: number): GuideBrowseItem[] {
  if (items.length <= limit) return items;
  const picked = new Set<number>();
  const seenGroups = new Set<string>();

  items.forEach((item, index) => {
    const group = item.badges[0];
    if (!group || seenGroups.has(group) || picked.size >= limit) return;
    seenGroups.add(group);
    picked.add(index);
  });

  for (let index = 0; index < items.length && picked.size < limit; index += 1) {
    picked.add(index);
  }

  return [...picked]
    .sort((left, right) => left - right)
    .map((index) => items[index]);
}

function visibleItems(section: GuideBrowseSection): GuideBrowseItem[] {
  const limit = DISPLAY_LIMITS[section.key];
  if (section.key === "itinerary") return representativeItineraries(section.items, limit);
  if (section.key === "attractions") return representativeAttractions(section.items, limit);
  return section.items.slice(0, limit);
}

function BrowseCard({ item }: { item: GuideBrowseItem }) {
  return (
    <article className={styles.card}>
      {item.badges.length > 0 && (
        <div className={styles.badges} aria-label="条目标签">
          {item.badges.map((badge) => <span key={badge}>{badge}</span>)}
        </div>
      )}
      <h4>{item.title}</h4>
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
  markdown,
  sections: structuredSections,
  onOpenFullGuide,
}: GuideBrowserProps) {
  const idPrefix = useId().replace(/:/g, "");
  const sections = useMemo(() => {
    try {
      return parseGuideBrowse(markdown, structuredSections);
    } catch {
      return [];
    }
  }, [markdown, structuredSections]);
  const [openKey, setOpenKey] = useState<GuideBrowseKey | null>(
    sections[0]?.key ?? null,
  );

  if (sections.length === 0) {
    return (
      <div className={styles.empty} role="note">
        <strong>这篇攻略暂时没有可提取的重点卡片</strong>
        <span>完整攻略仍然保留，可以继续阅读原文。</span>
        <button type="button" onClick={onOpenFullGuide}>打开完整攻略</button>
      </div>
    );
  }

  return (
    <section className={styles.browser} aria-labelledby={`${idPrefix}-${guideId}-browser-title`}>
      <div className={styles.explainer}>
        <span className={styles.explainerMark} aria-hidden="true">原</span>
        <div>
          <h3 id={`${idPrefix}-${guideId}-browser-title`}>按主题浏览攻略重点</h3>
          <p>卡片直接摘自原攻略的章节与表格，并保留原文顺序；点开主题查看，没有补写内容。</p>
        </div>
      </div>

      <div className={styles.accordion}>
        {sections.map((section, index) => {
          const isOpen = openKey === section.key;
          const buttonId = `${idPrefix}-${guideId}-${section.key}-button`;
          const panelId = `${idPrefix}-${guideId}-${section.key}-panel`;
          const shownItems = visibleItems(section);
          const remaining = section.totalCount - shownItems.length;

          return (
            <section className={`${styles.topic} ${isOpen ? styles.topicOpen : ""}`} key={section.key}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenKey(isOpen ? null : section.key)}
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
                  <span>{remaining > 0 ? `精选 ${shownItems.length} / ${section.totalCount}` : `共 ${section.totalCount} 条`}</span>
                </div>
                <div className={styles.cards}>
                  {shownItems.map((item) => <BrowseCard key={item.id} item={item} />)}
                </div>
                <div className={styles.topicFooter}>
                  <span>
                    {remaining > 0
                      ? `完整攻略中还有 ${remaining} 条原文内容`
                      : "当前主题卡片已全部展开"}
                  </span>
                  <button type="button" onClick={onOpenFullGuide}>继续读完整攻略 →</button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className={styles.coverageNote}>完整攻略另含不同旅行者须知、来源与更新记录。</p>
    </section>
  );
}
