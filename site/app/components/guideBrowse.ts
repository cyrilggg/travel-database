import type { GuideSection } from "../generated/guides";

export type GuideBrowseKey =
  | "overview"
  | "regions"
  | "attractions"
  | "food"
  | "itinerary"
  | "stay"
  | "transport"
  | "checklist";

export type GuideBrowseLink = {
  label: string;
  href: string;
};

export type GuideBrowseField = {
  label: string;
  value: string;
  links?: GuideBrowseLink[];
};

export type GuideBrowseItem = {
  id: string;
  title: string;
  description?: string;
  badges: string[];
  fields: GuideBrowseField[];
};

export type GuideBrowseSection = {
  key: GuideBrowseKey;
  label: string;
  hint: string;
  sourceTitle: string;
  items: GuideBrowseItem[];
  totalCount: number;
};

type SectionDefinition = {
  key: GuideBrowseKey;
  label: string;
  hint: string;
  matches: RegExp[];
};

type MarkdownSection = {
  title: string;
  lines: string[];
};

type MarkdownTable = {
  context: string;
  headers: string[];
  rows: string[][];
};

type HeadingGroup = {
  title: string;
  lines: string[];
};

type FieldSpec = {
  label: string;
  aliases: RegExp[];
  links?: boolean;
};

export const GUIDE_BROWSE_DEFINITIONS: readonly SectionDefinition[] = [
  {
    key: "overview",
    label: "城市速览",
    hint: "季节、预算与旅行强度",
    matches: [/城市速览/, /(?:城市|目的地).*(?:概览|速览)/],
  },
  {
    key: "regions",
    label: "片区",
    hint: "按区域理解城市",
    matches: [/城市格局/, /游览区域/, /旅行片区/],
  },
  {
    key: "attractions",
    label: "主要景点",
    hint: "看点、用时与取舍",
    matches: [/主要景点/, /核心景点/, /景点与体验/],
  },
  {
    key: "food",
    label: "美食",
    hint: "菜品、份量与饮食限制",
    matches: [/美食/, /餐饮/],
  },
  {
    key: "itinerary",
    label: "经典行程",
    hint: "按天数与场景选路线",
    matches: [/经典行程/, /行程/, /路线/],
  },
  {
    key: "stay",
    label: "住宿",
    hint: "区域优缺点与适合人群",
    matches: [/住宿/],
  },
  {
    key: "transport",
    label: "交通",
    hint: "到达、移动与动态核对",
    matches: [/市内交通/, /交通/],
  },
  {
    key: "checklist",
    label: "行前核对",
    hint: "出发前需要重查的事项",
    matches: [/行前核对/, /出发前.*核对/, /行前准备/],
  },
] as const;

const TABLE_DIVIDER = /^:?-{3,}:?$/;
const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/gi;

function plainText(value: string): string {
  return value
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) =>
      String(label ?? target).trim(),
    )
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\\\s*$/g, " ")
    .replace(/^[>\s]*[-*+]\s+/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .replace(/[`*_~]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(value: string): GuideBrowseLink[] {
  const links: GuideBrowseLink[] = [];
  const seen = new Set<string>();

  for (const match of value.matchAll(MARKDOWN_LINK)) {
    const href = match[2];
    if (seen.has(href)) continue;

    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    } catch {
      continue;
    }

    seen.add(href);
    links.push({ label: plainText(match[1]) || "官方入口", href });
  }

  return links;
}

function normalize(value: string): string {
  return plainText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function withoutFencedBlocks(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let fence: { marker: string; length: number } | undefined;

  return lines.map((line) => {
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (
        closing &&
        closing[1][0] === fence.marker &&
        closing[1].length >= fence.length
      ) {
        fence = undefined;
      }
      return "";
    }

    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening) {
      fence = { marker: opening[1][0], length: opening[1].length };
      return "";
    }

    return line;
  });
}

function splitSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | undefined;

  for (const line of withoutFencedBlocks(markdown)) {
    const heading = /^ {0,3}##(?!#)[ \t]+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { title: plainText(heading[1].replace(/\s+#+\s*$/, "")), lines: [] };
      continue;
    }

    current?.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function classifySection(title: string): GuideBrowseKey | undefined {
  const normalizedTitle = normalize(title);
  return GUIDE_BROWSE_DEFINITIONS.find((definition) =>
    definition.matches.some((pattern) => pattern.test(normalizedTitle)),
  )?.key;
}

function resolveSections(
  markdownSections: MarkdownSection[],
  structuredSections: readonly GuideSection[],
): Map<GuideBrowseKey, MarkdownSection> {
  const byTitle = new Map(
    markdownSections.map((section) => [normalize(section.title), section]),
  );
  const resolved = new Map<GuideBrowseKey, MarkdownSection>();

  for (const section of structuredSections) {
    if (section.level !== 2) continue;
    const key = classifySection(section.title);
    const markdownSection = byTitle.get(normalize(section.title));
    if (key && markdownSection && !resolved.has(key)) {
      resolved.set(key, markdownSection);
    }
  }

  for (const section of markdownSections) {
    const key = classifySection(section.title);
    if (key && !resolved.has(key)) resolved.set(key, section);
  }

  return resolved;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseTables(lines: string[]): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  let context = "";

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^ {0,3}#{3,4}[ \t]+(.+?)\s*$/.exec(lines[index]);
    if (heading) {
      context = plainText(heading[1].replace(/\s+#+\s*$/, ""));
      continue;
    }

    const headers = parseTableRow(lines[index]);
    const divider = parseTableRow(lines[index + 1] ?? "");
    if (
      headers.length === 0 ||
      divider.length !== headers.length ||
      !divider.every((cell) => TABLE_DIVIDER.test(cell.replace(/\s/g, "")))
    ) {
      continue;
    }

    const rows: string[][] = [];
    index += 2;
    while (index < lines.length) {
      const row = parseTableRow(lines[index]);
      if (row.length !== headers.length) break;
      rows.push(row);
      index += 1;
    }
    index -= 1;

    if (rows.length > 0) tables.push({ context, headers, rows });
  }

  return tables;
}

function headingGroups(lines: string[]): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  let current: HeadingGroup | undefined;

  for (const line of lines) {
    const heading = /^ {0,3}###(?!#)[ \t]+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) groups.push(current);
      current = { title: plainText(heading[1].replace(/\s+#+\s*$/, "")), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }

  if (current) groups.push(current);
  return groups;
}

function headerIndex(headers: string[], aliases: RegExp[], excluded = new Set<number>()): number {
  const normalizedHeaders = headers.map(normalize);
  return normalizedHeaders.findIndex(
    (header, index) => !excluded.has(index) && aliases.some((pattern) => pattern.test(header)),
  );
}

function firstMeaningfulParagraph(lines: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (
      !line ||
      /^#{3,6}\s/.test(line) ||
      line.startsWith("|") ||
      TABLE_DIVIDER.test(line.replace(/[|\s]/g, "")) ||
      /^[-*+]\s+/.test(line)
    ) {
      continue;
    }

    const paragraph = [line];
    while (index + 1 < lines.length) {
      const next = lines[index + 1].trim();
      if (!next || /^#{3,6}\s/.test(next) || next.startsWith("|") || /^[-*+]\s+/.test(next)) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    const text = plainText(paragraph.join(" "));
    if (text) return text;
  }

  return "";
}

function labeledLines(lines: string[]): Array<{ label: string; value: string; raw: string }> {
  const entries: Array<{ label: string; value: string; raw: string }> = [];

  for (const raw of lines) {
    const line = raw.trim().replace(/^[-*+]\s+/, "");
    const match = /^\*\*([^*]+?)\*\*\s*[：:]?\s*(.+?)\s*\\?\s*$/.exec(line);
    if (!match) continue;
    const label = plainText(match[1]).replace(/[：:]$/, "").trim();
    const value = plainText(match[2]);
    if (label && value) entries.push({ label, value, raw: match[2] });
  }

  return entries;
}

function bulletItems(lines: string[]): Array<{ title: string; description: string; raw: string }> {
  const items: Array<{ title: string; description: string; raw: string }> = [];

  for (const raw of lines) {
    if (!/^\s*[-*+]\s+/.test(raw)) continue;
    const line = raw.trim().replace(/^[-*+]\s+/, "");
    const labeled = /^\*\*([^*]+?)\*\*\s*[：:]?\s*(.+)$/.exec(line);
    if (labeled) {
      items.push({
        title: plainText(labeled[1]).replace(/[：:]$/, ""),
        description: plainText(labeled[2]),
        raw: labeled[2],
      });
      continue;
    }

    const separated = /^(.{1,35}?)[：:]\s*(.+)$/.exec(line);
    if (separated && !separated[1].includes("[")) {
      const title = plainText(separated[1]);
      const rawValue = separated[2];
      const description = plainText(rawValue);
      if (title && description) {
        items.push({ title, description, raw: rawValue });
        continue;
      }
    }

    const text = plainText(line);
    if (text) items.push({ title: text, description: "", raw: line });
  }

  return items;
}

function field(
  label: string,
  rawValue: string | undefined,
  includeLinks = false,
): GuideBrowseField | undefined {
  if (!rawValue) return undefined;
  const links = includeLinks ? extractLinks(rawValue) : [];
  const value = plainText(includeLinks ? rawValue.replace(MARKDOWN_LINK, " ") : rawValue);
  if (!value && links.length === 0) return undefined;
  return { label, value, ...(links.length > 0 ? { links } : {}) };
}

function fieldsFromRow(
  headers: string[],
  row: string[],
  specs: FieldSpec[],
  excluded: Set<number>,
  maximum: number,
): GuideBrowseField[] {
  const fields: GuideBrowseField[] = [];
  const used = new Set(excluded);

  for (const spec of specs) {
    const index = headerIndex(headers, spec.aliases, used);
    if (index < 0) continue;
    const nextField = field(spec.label, row[index], spec.links);
    used.add(index);
    if (nextField) fields.push(nextField);
    if (fields.length >= maximum) return fields;
  }

  for (let index = 0; index < row.length && fields.length < maximum; index += 1) {
    if (used.has(index)) continue;
    const nextField = field(plainText(headers[index]), row[index]);
    if (nextField) fields.push(nextField);
  }

  return fields;
}

function tableItems(
  key: GuideBrowseKey,
  tables: MarkdownTable[],
  nameAliases: RegExp[],
  fieldSpecs: FieldSpec[],
  options: {
    descriptionAliases?: RegExp[];
    badgeAliases?: RegExp[];
    includeContextBadge?: boolean;
  } = {},
): GuideBrowseItem[] {
  const items: GuideBrowseItem[] = [];

  for (const table of tables) {
    const nameIndex = headerIndex(table.headers, nameAliases);
    if (nameIndex < 0) continue;
    const descriptionIndex = options.descriptionAliases
      ? headerIndex(table.headers, options.descriptionAliases, new Set([nameIndex]))
      : -1;
    const badgeIndexes = (options.badgeAliases ?? [])
      .map((alias) => headerIndex(table.headers, [alias], new Set([nameIndex, descriptionIndex])))
      .filter((index, position, all) => index >= 0 && all.indexOf(index) === position);

    for (const row of table.rows) {
      const title = plainText(row[nameIndex]);
      if (!title) continue;
      const description = descriptionIndex >= 0 ? plainText(row[descriptionIndex]) : "";
      const excluded = new Set([nameIndex]);
      if (descriptionIndex >= 0) excluded.add(descriptionIndex);
      badgeIndexes.forEach((index) => excluded.add(index));
      const badges = badgeIndexes
        .map((index) => plainText(row[index]))
        .filter(Boolean)
        .slice(0, 4);
      if (options.includeContextBadge && table.context) badges.unshift(table.context);

      items.push({
        id: `${key}-${items.length + 1}`,
        title,
        ...(description ? { description } : {}),
        badges: [...new Set(badges)].slice(0, 4),
        fields: fieldsFromRow(table.headers, row, fieldSpecs, excluded, 3),
      });
    }
  }

  return items;
}

function overviewItems(tables: MarkdownTable[]): GuideBrowseItem[] {
  const table = tables.find((candidate) => candidate.headers.length === 2) ?? tables[0];
  if (!table) return [];

  return table.rows
    .map((row, index) => ({
      id: `overview-${index + 1}`,
      title: plainText(row[0]),
      description: plainText(row.slice(1).join(" ")),
      badges: [],
      fields: [],
    }))
    .filter((item) => item.title && item.description);
}

function regionItems(section: MarkdownSection, tables: MarkdownTable[]): GuideBrowseItem[] {
  const items = tableItems(
    "regions",
    tables,
    [/^区域$/, /片区/, /游览区/, /方向/, /范围/, /地点/],
    [
      { label: "主要内容", aliases: [/主要内容/, /旅行内容/, /代表内容/, /看点/, /景点/] },
      { label: "游览特点", aliases: [/游览特点/, /特点/, /节奏/, /适合/] },
      { label: "如何衔接", aliases: [/关系/, /衔接/, /组合/, /交通/, /距离/] },
    ],
  );
  if (items.length > 0) return items;

  return headingGroups(section.lines).map((group, index) => ({
    id: `regions-${index + 1}`,
    title: group.title,
    description: firstMeaningfulParagraph(group.lines),
    badges: [],
    fields: [],
  }));
}

function attractionItems(tables: MarkdownTable[]): GuideBrowseItem[] {
  const attractionTables = tables.filter((table) =>
    table.headers.some((header) => /(?:建议)?用时|时长/.test(normalize(header))),
  );

  return tableItems(
    "attractions",
    attractionTables.length > 0 ? attractionTables : tables,
    [/^景点$/, /目的地/, /场馆/, /地点/, /名称/, /项目/],
    [
      { label: "所在区域", aliases: [/区域/, /位置/, /所属/] },
      { label: "建议用时", aliases: [/建议用时/, /用时/, /时长/] },
      { label: "游览提醒", aliases: [/预约/, /天气/, /体力/, /提醒/] },
    ],
    {
      descriptionAliases: [/主要看点/, /看点/, /旅行价值/, /内容/],
      badgeAliases: [/优先级/, /^类型$/, /体力/, /预约风险/],
      includeContextBadge: true,
    },
  );
}

function foodItems(tables: MarkdownTable[]): GuideBrowseItem[] {
  const foodTables = tables.filter((table) =>
    table.headers.some((header) => /份量|过敏|点单|饮食限制|一个人/.test(normalize(header))),
  );

  return tableItems(
    "food",
    foodTables.length > 0 ? foodTables : tables,
    [/菜品/, /食物/, /餐饮类型/, /餐饮区域/, /饮食/, /小吃/, /名称/, /品类/],
    [
      { label: "适合体验", aliases: [/适合体验/, /主要内容/] },
      { label: "一个人怎么点", aliases: [/一个人/, /份量/, /点单/, /独行/] },
      { label: "饮食限制", aliases: [/过敏/, /饮食限制/, /风味/, /忌口/] },
      { label: "替代方法", aliases: [/排队/, /替代/, /选择/] },
    ],
    {
      descriptionAliases: [/适合体验/, /风味.*过敏/, /特色/, /主要内容/],
      badgeAliases: [/常见区域/, /^区域$/, /地点/],
    },
  );
}

function itineraryItems(section: MarkdownSection, tables: MarkdownTable[]): GuideBrowseItem[] {
  const groups = headingGroups(section.lines);
  if (groups.length > 0) {
    return groups.map((group, index) => {
      const entries = labeledLines(group.lines);
      const routeEntries = entries.filter((entry) => /路线|第.+天/.test(entry.label));
      const detailEntries = entries.filter((entry) =>
        /串联|预约|休息|时间不足|适用|减负/.test(entry.label),
      );
      const description = routeEntries.length > 0
        ? routeEntries
            .slice(0, 3)
            .map((entry) => `${entry.label}：${entry.value}`)
            .join("；")
        : firstMeaningfulParagraph(group.lines);

      return {
        id: `itinerary-${index + 1}`,
        title: group.title,
        ...(description ? { description } : {}),
        badges: [],
        fields: detailEntries
          .slice(0, 3)
          .map((entry) => field(entry.label, entry.raw))
          .filter((entry): entry is GuideBrowseField => Boolean(entry)),
      };
    });
  }

  const fromTables = tableItems(
    "itinerary",
    tables,
    [/路线/, /行程/, /天数/, /主题/, /名称/],
    [
      { label: "安排", aliases: [/安排/, /内容/, /路线/, /上午/, /下午/] },
      { label: "适合", aliases: [/适合/, /说明/, /取舍/] },
      { label: "提醒", aliases: [/预约/, /提醒/, /天气/] },
    ],
  );
  if (fromTables.length > 0) return fromTables;

  return bulletItems(section.lines).map((item, index) => ({
    id: `itinerary-${index + 1}`,
    title: item.title,
    ...(item.description ? { description: item.description } : {}),
    badges: [],
    fields: [],
  }));
}

function stayItems(tables: MarkdownTable[]): GuideBrowseItem[] {
  return tableItems(
    "stay",
    tables,
    [/^区域$/, /住宿区域/, /片区/, /地点/, /位置/],
    [
      { label: "适合人群", aliases: [/适合人群/, /适合/] },
      { label: "需要取舍", aliases: [/缺点/, /取舍/, /不足/, /注意/] },
      { label: "交通特点", aliases: [/交通特点/, /交通/, /出行/] },
    ],
    { descriptionAliases: [/优点/, /优势/, /特点/] },
  );
}

function fallbackSectionItems(
  key: "transport" | "checklist",
  section: MarkdownSection,
): GuideBrowseItem[] {
  const groups = headingGroups(section.lines);
  if (groups.length > 0) {
    return groups.map((group, index) => ({
      id: `${key}-${index + 1}`,
      title: group.title,
      description: firstMeaningfulParagraph(group.lines),
      badges: [],
      fields: bulletItems(group.lines)
        .slice(0, 2)
        .map((item) => field(item.title, item.raw))
        .filter((entry): entry is GuideBrowseField => Boolean(entry)),
    }));
  }

  const labeled = labeledLines(section.lines);
  if (labeled.length > 0) {
    return labeled.map((entry, index) => {
      const links = key === "checklist" ? extractLinks(entry.raw) : [];
      return {
        id: `${key}-${index + 1}`,
        title: entry.label.replace(/[。.；;]$/, ""),
        description: entry.value,
        badges: [],
        fields: links.length > 0 ? [{ label: "官方入口", value: "", links }] : [],
      };
    });
  }

  const bullets = bulletItems(section.lines).map((item, index) => ({
    id: `${key}-${index + 1}`,
    title: item.title,
    ...(item.description ? { description: item.description } : {}),
    badges: [],
    fields: [],
  }));
  if (bullets.length > 0) return bullets;

  const paragraph = firstMeaningfulParagraph(section.lines);
  return paragraph
    ? [{
        id: `${key}-1`,
        title: key === "transport" ? "市内交通要点" : "行前提醒",
        description: paragraph,
        badges: [],
        fields: [],
      }]
    : [];
}

function transportItems(section: MarkdownSection, tables: MarkdownTable[]): GuideBrowseItem[] {
  const items = tableItems(
    "transport",
    tables,
    [/场景/, /交通方式/, /方式/, /环节/, /节点/, /枢纽/, /到达/, /路线/, /出行/],
    [
      { label: "建议与取舍", aliases: [/建议.*取舍/, /建议/, /旅行判断/, /如何安排/] },
      { label: "行前重查", aliases: [/行前.*重查/, /重查/, /核对/, /变化/] },
    ],
  );
  return items.length > 0 ? items : fallbackSectionItems("transport", section);
}

function checklistItems(section: MarkdownSection, tables: MarkdownTable[]): GuideBrowseItem[] {
  const items = tableItems(
    "checklist",
    tables,
    [/核对事项/, /事项/, /项目/, /内容/],
    [
      { label: "为什么重查", aliases: [/为什么/, /原因/, /变化/] },
      { label: "何时核对", aliases: [/建议核对时间/, /核对时间/, /何时/, /时间/] },
      { label: "官方入口", aliases: [/官方入口/, /官方渠道/, /官方锚点/, /首选渠道/, /入口/, /来源/], links: true },
    ],
  );
  if (items.length > 0) return items;

  return fallbackSectionItems("checklist", section).map((item, index) => {
    const rawBullet = bulletItems(section.lines)[index]?.raw ?? "";
    const links = extractLinks(rawBullet);
    return links.length > 0
      ? { ...item, fields: [{ label: "官方入口", value: "", links }] }
      : item;
  });
}

function extractItems(key: GuideBrowseKey, section: MarkdownSection): GuideBrowseItem[] {
  const tables = parseTables(section.lines);

  switch (key) {
    case "overview":
      return overviewItems(tables);
    case "regions":
      return regionItems(section, tables);
    case "attractions":
      return attractionItems(tables);
    case "food":
      return foodItems(tables);
    case "itinerary":
      return itineraryItems(section, tables);
    case "stay":
      return stayItems(tables);
    case "transport":
      return transportItems(section, tables);
    case "checklist":
      return checklistItems(section, tables);
  }
}

export function parseGuideBrowse(
  markdown: string,
  structuredSections: readonly GuideSection[] = [],
): GuideBrowseSection[] {
  const markdownSections = splitSections(markdown);
  const resolved = resolveSections(markdownSections, structuredSections);

  return GUIDE_BROWSE_DEFINITIONS.flatMap((definition) => {
    const source = resolved.get(definition.key);
    if (!source) return [];
    const items = extractItems(definition.key, source).filter(
      (item) => item.title || item.description || item.fields.length > 0,
    );
    if (items.length === 0) return [];

    return [{
      key: definition.key,
      label: definition.label,
      hint: definition.hint,
      sourceTitle: source.title,
      items,
      totalCount: items.length,
    }];
  });
}
