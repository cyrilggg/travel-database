"use client";

import { type ReactNode, useEffect, useState } from "react";
import GuideContent from "./GuideContent";
import styles from "./GuideContentLoader.module.css";

const markdownCache = new Map<string, string>();
const MAX_CACHED_GUIDES = 12;

function resolveContentUrl(path: string) {
  if (typeof document === "undefined") return path;
  return new URL(path.replace(/^\/+/, ""), document.baseURI).toString();
}

function cacheMarkdown(path: string, markdown: string) {
  if (!markdown.trim()) throw new Error("Guide response was empty");
  markdownCache.delete(path);
  markdownCache.set(path, markdown);

  while (markdownCache.size > MAX_CACHED_GUIDES) {
    const oldestPath = markdownCache.keys().next().value;
    if (typeof oldestPath !== "string") break;
    markdownCache.delete(oldestPath);
  }
}

type GuideContentLoaderProps = {
  contentPath: string;
  children?: (markdown: string) => ReactNode;
  loadingLabel?: string;
};

export default function GuideContentLoader({
  contentPath,
  children,
  loadingLabel = "正在翻开完整攻略",
}: GuideContentLoaderProps) {
  const [result, setResult] = useState<{
    path: string;
    markdown: string;
    failed: boolean;
  } | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

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
        cacheMarkdown(contentPath, source);
        setResult({ path: contentPath, markdown: source, failed: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ path: contentPath, markdown: "", failed: true });
      });

    return () => controller.abort();
  }, [contentPath, requestVersion]);

  if (failed) {
    return (
      <div className="guide-load-state is-error" role="status">
        <strong>正文暂时没有打开</strong>
        <span>网络恢复后可以直接重试，已经打开的攻略不会重复下载。</span>
        <button
          className={styles.retryButton}
          type="button"
          onClick={() => {
            setResult(null);
            setRequestVersion((version) => version + 1);
          }}
        >
          重新加载
        </button>
      </div>
    );
  }

  if (!markdown) {
    return (
      <div className="guide-load-state" aria-live="polite">
        <span className="guide-load-line is-long" />
        <span className="guide-load-line" />
        <span className="guide-load-line is-short" />
        <small>{loadingLabel}</small>
      </div>
    );
  }

  return children ? children(markdown) : <GuideContent markdown={markdown} />;
}
