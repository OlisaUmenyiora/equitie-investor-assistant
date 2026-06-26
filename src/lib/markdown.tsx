import { Fragment, type ReactNode } from "react";

// Light markdown -> React elements (rendered as real nodes, so there is no raw-HTML
// injection surface). Supports: **bold**, `code`, bullet/numbered lists, paragraphs.
// That is all the assistant emits.

/** Strip a trailing "Sources: …" line — citations are rendered as chips separately. */
export function stripSourcesLine(text: string): string {
  return text.replace(/\n?\s*Sources?:\s*[A-Z0-9 ,_-]+\.?\s*$/i, "").trimEnd();
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** and `code`, keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(<code key={i}>{part.slice(1, -1)}</code>);
    } else {
      nodes.push(<Fragment key={i}>{part}</Fragment>);
    }
  });
  return nodes;
}

export function MarkdownText({ text }: { text: string }) {
  const lines = stripSourcesLine(text).split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={key++}>{inline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (listType && listItems.length) {
      const items = listItems.map((it, i) => <li key={i}>{inline(it)}</li>);
      blocks.push(
        listType === "ul" ? <ul key={key++}>{items}</ul> : <ol key={key++}>{items}</ol>,
      );
    }
    listItems = [];
    listType = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numbered[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();

  return <>{blocks}</>;
}
