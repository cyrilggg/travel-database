"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { GuideBrowseSection } from "../generated/publicGuides";

const cache = new Map<string, GuideBrowseSection[]>();

function resolveContentUrl(path: string) {
  if (typeof document === "undefined") return path;
  return new URL(path.replace(/^\/+/, ""), document.baseURI).toString();
}

export default function GuideStructureLoader({
  contentPath,
  children,
}: {
  contentPath: string;
  children: (sections: GuideBrowseSection[]) => ReactNode;
}) {
  const [result, setResult] = useState<{
    path: string;
    sections: GuideBrowseSection[];
    failed: boolean;
  } | null>(null);
  const sections = cache.get(contentPath) ?? (result?.path === contentPath ? result.sections : null);
  const failed = result?.path === contentPath && result.failed;

  useEffect(() => {
    if (cache.has(contentPath)) return;
    const controller = new AbortController();
    fetch(resolveContentUrl(contentPath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Structure request failed: ${response.status}`);
        return response.json() as Promise<GuideBrowseSection[]>;
      })
      .then((result) => {
        cache.set(contentPath, result);
        setResult({ path: contentPath, sections: result, failed: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ path: contentPath, sections: [], failed: true });
      });
    return () => controller.abort();
  }, [contentPath]);

  if (failed) {
    return <p className="guide-load-state is-error">结构化内容暂时没有加载出来，请刷新后重试。</p>;
  }
  if (!sections) {
    return <p className="guide-load-state">正在展开攻略要点…</p>;
  }
  return children(sections);
}
