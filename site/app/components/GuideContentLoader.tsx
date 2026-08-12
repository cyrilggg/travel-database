"use client";

import { useEffect, useState } from "react";
import GuideContent from "./GuideContent";

const markdownCache = new Map<string, string>();

const resolveContentUrl = (contentPath: string) => {
  if (typeof document === "undefined") return contentPath;
  return new URL(contentPath.replace(/^\/+/, ""), document.baseURI).toString();
};

type GuideContentLoaderProps = {
  contentPath: string;
};

export default function GuideContentLoader({ contentPath }: GuideContentLoaderProps) {
  const [result, setResult] = useState<{
    path: string;
    markdown: string;
    failed: boolean;
  } | null>(null);

  const cachedMarkdown = markdownCache.get(contentPath);
  const markdown = cachedMarkdown ?? (result?.path === contentPath ? result.markdown : "");
  const failed = result?.path === contentPath && result.failed;

  useEffect(() => {
    if (markdownCache.has(contentPath)) return;

    const controller = new AbortController();

    fetch(resolveContentUrl(contentPath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Guide request failed: ${response.status}`);
        return response.text();
      })
      .then((source) => {
        markdownCache.set(contentPath, source);
        setResult({ path: contentPath, markdown: source, failed: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ path: contentPath, markdown: "", failed: true });
      });

    return () => controller.abort();
  }, [contentPath]);

  if (failed) {
    return (
      <div className="guide-load-state is-error" role="status">
        <strong>正文暂时没有打开</strong>
        <span>可以先返回速览，稍后再试。</span>
      </div>
    );
  }

  if (!markdown) {
    return (
      <div className="guide-load-state" aria-live="polite">
        <span className="guide-load-line is-long" />
        <span className="guide-load-line" />
        <span className="guide-load-line is-short" />
        <small>正在翻开完整攻略</small>
      </div>
    );
  }

  return <GuideContent markdown={markdown} />;
}
