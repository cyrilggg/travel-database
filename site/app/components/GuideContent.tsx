import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface GuideContentProps {
  markdown: string;
  className?: string;
}

const OBSIDIAN_LINK_PATTERN = /!?\[\[([^\]\r\n]+)\]\]/g;

function replaceObsidianLinks(markdown: string): string {
  return markdown.replace(OBSIDIAN_LINK_PATTERN, (_match, contents: string) => {
    const separator = contents.indexOf("|");
    const target = (separator === -1 ? contents : contents.slice(0, separator)).trim();
    const label = separator === -1 ? target : contents.slice(separator + 1).trim();

    return label || target;
  });
}

function findFirstH1Line(markdown: string): number | undefined {
  const lines = markdown.split(/\r?\n/);
  let fence: { marker: string; length: number } | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      const closingFence = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (
        closingFence &&
        closingFence[1][0] === fence.marker &&
        closingFence[1].length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }

    const openingFence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (openingFence) {
      fence = {
        marker: openingFence[1][0],
        length: openingFence[1].length,
      };
      continue;
    }

    if (/^ {0,3}#(?:[\t ]+|$)/.test(line)) {
      return index + 1;
    }

    if (
      index > 0 &&
      /^ {0,3}=+\s*$/.test(line) &&
      lines[index - 1].trim().length > 0
    ) {
      return index;
    }
  }

  return undefined;
}

function isMermaidCodeBlock(children: ReactNode): boolean {
  const child = Children.toArray(children).find((item) => isValidElement(item));
  if (!isValidElement<{ className?: string }>(child)) {
    return false;
  }

  return Boolean(
    child.props.className
      ?.split(/\s+/)
      .some((name) => name.toLowerCase() === "language-mermaid"),
  );
}

function withoutMarkdownNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const domProps = { ...props };
  delete domProps.node;
  return domProps;
}

function isExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:https?:)?\/\//i.test(href));
}

function createMarkdownComponents(firstH1Line: number | undefined): Components {
  return {
    h1(props) {
      if (
        firstH1Line !== undefined &&
        props.node?.position?.start.line === firstH1Line
      ) {
        return null;
      }

      return <h1 {...withoutMarkdownNode(props)}>{props.children}</h1>;
    },
    pre(props) {
      if (isMermaidCodeBlock(props.children)) {
        return (
          <div className="guide-mermaid-placeholder" role="note">
            路线结构图，请在原知识库查看
          </div>
        );
      }

      return <pre {...withoutMarkdownNode(props)} />;
    },
    table(props) {
      return (
        <div className="guide-table-scroll">
          <table {...withoutMarkdownNode(props)} />
        </div>
      );
    },
    a(props) {
      const linkProps = withoutMarkdownNode(props);

      if (isExternalLink(props.href)) {
        return (
          <a
            {...linkProps}
            target="_blank"
            rel="noopener noreferrer"
          >
            {props.children}
          </a>
        );
      }

      return <a {...linkProps}>{props.children}</a>;
    },
  };
}

export function GuideContent({ markdown, className }: GuideContentProps) {
  const preparedMarkdown = replaceObsidianLinks(markdown);
  const firstH1Line = findFirstH1Line(preparedMarkdown);
  const rootClassName = ["guide-content", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={createMarkdownComponents(firstH1Line)}
      >
        {preparedMarkdown}
      </ReactMarkdown>
    </div>
  );
}

export default GuideContent;
