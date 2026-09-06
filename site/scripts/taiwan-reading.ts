import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export const taiwanRoot = "destinations/中国/台湾省";

export async function loadTaiwanReadings(projectRoot: string) {
  const regionalRoot = `${taiwanRoot}/旅行区域`;
  let names: string[] = [];
  try {
    names = (await readdir(path.join(projectRoot, regionalRoot), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sources = [
    { id: "taiwan-overview", sourcePath: `${taiwanRoot}/README.md` },
    ...names.map((name) => ({ id: `taiwan-region-${name}`, sourcePath: `${regionalRoot}/${name}/README.md` })),
  ];
  return Promise.all(sources.map(async (source) => {
    const markdown = matter(await readFile(path.join(projectRoot, source.sourcePath), "utf8")).content.trim();
    const title = markdown.match(/^#\s+(.+)$/m)?.[1];
    if (!title) throw new Error(`${source.sourcePath} 缺少标题`);
    return { ...source, title, markdown, fullTextPath: `/structured/${encodeURIComponent(source.id)}.md` };
  }));
}

export function rewriteReadingLinks(markdown: string, sourcePath: string, targets: Map<string, string>) {
  return markdown.replace(/(!?)\[([^\]]+)\]\(([^)]+)\)/g, (original, image: string, label: string, raw: string) => {
    const target = raw.trim();
    if (/^(?:https?:|mailto:|#)/i.test(target)) return original;
    if (image) return label;
    const file = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), file));
    const id = targets.get(resolved);
    return id ? `[${label}](#reading=${encodeURIComponent(id)})` : label;
  });
}
