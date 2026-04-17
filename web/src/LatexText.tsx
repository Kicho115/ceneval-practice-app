import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

type Segment =
  | { kind: "text"; text: string }
  | { kind: "math"; latex: string; display: boolean };

function parseMixedMath(input: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < input.length) {
    const j = input.indexOf("$", i);
    if (j === -1) {
      if (i < input.length) out.push({ kind: "text", text: input.slice(i) });
      break;
    }
    if (j > i) out.push({ kind: "text", text: input.slice(i, j) });
    if (input[j + 1] === "$") {
      const end = input.indexOf("$$", j + 2);
      if (end === -1) {
        out.push({ kind: "text", text: input.slice(j) });
        break;
      }
      const latex = input.slice(j + 2, end).trim();
      if (latex.length > 0) {
        out.push({ kind: "math", latex, display: true });
      }
      i = end + 2;
    } else {
      const end = input.indexOf("$", j + 1);
      if (end === -1) {
        out.push({ kind: "text", text: input.slice(j) });
        break;
      }
      const latex = input.slice(j + 1, end);
      if (latex.length > 0) {
        out.push({ kind: "math", latex, display: false });
      }
      i = end + 1;
    }
  }
  return out;
}

/** Renders plain text with optional `$...$` / `$$...$$` fragments as KaTeX. */
export function LatexText({ text }: { text: string }) {
  const segments = useMemo(() => parseMixedMath(text), [text]);

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === "text") {
          return <span key={idx}>{seg.text}</span>;
        }
        const html = katex.renderToString(seg.latex, {
          throwOnError: false,
          displayMode: seg.display,
          strict: "ignore",
        });
        return (
          <span
            key={idx}
            // eslint-disable-next-line react/no-danger -- KaTeX output only
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}
