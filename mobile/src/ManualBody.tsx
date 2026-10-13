import React from "react";
import { Text, View } from "react-native";
import type { ContentBlock } from "./api";
import { s } from "./styles";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
type Paragraph = NonNullable<ContentBlock["metadata"]>["paragraphs"][number];

// Preserve every character and emphasis when separating items for display.
function sliceRuns(runs: Paragraph["runs"], start: number, end: number) {
  let offset = 0;
  return runs.flatMap((run) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    return to > from ? [{ ...run, text: run.text.slice(from, to) }] : [];
  });
}

function separateItems(paragraph: Paragraph, type: string): Paragraph[] {
  const text = paragraph.runs.map((run) => run.text).join("");
  const boundaries = [0];
  if (type === "numbered_list") {
    // Legacy API bodies may concatenate steps into a single paragraph.
    const starts = /(?:^|\s)(?:\d{1,2}[.)]\s+|Rotação (?:Medial|Lateral)\b)/g;
    for (const match of text.matchAll(starts)) {
      const start = match.index + (/^\s/.test(match[0]) ? 1 : 0);
      if (start > 0) boundaries.push(start);
    }
  } else if (["quality_criteria", "common_errors"].includes(type)) {
    for (const match of text.matchAll(/;\s+(?=\S)/g)) {
      boundaries.push(match.index + 1);
    }
  }
  boundaries.push(text.length);
  return boundaries.slice(0, -1).map((start, index) => {
    const runs = sliceRuns(paragraph.runs, start, boundaries[index + 1]);
    const body = runs.map((run) => run.text).join("").trim();
    return {
      ...paragraph,
      runs,
      kind: /^\d+[.)]\s/.test(body)
        ? "numbered"
        : type === "numbered_list" && /^Rotação (Medial|Lateral)$/.test(body)
          ? "subheading"
          : ["quality_criteria", "common_errors"].includes(type)
            ? "bullet"
            : paragraph.kind,
    };
  });
}

export default function ManualBody({ block }: { block: ContentBlock }) {
  const paragraphs = block.metadata?.paragraphs;
  const valid =
    Array.isArray(paragraphs) &&
    paragraphs.length > 0 &&
    paragraphs.every(
      (p) =>
        Array.isArray(p.runs) &&
        p.runs.every((r) => typeof r.text === "string"),
    ) &&
    normalize(
      paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join(" "),
    ) === normalize(block.body);
  const source: Paragraph[] = valid
    ? paragraphs
    : block.body.split(/\n\s*\n/).filter((text) => text.trim()).map((text) => ({
        kind: "paragraph",
        runs: [{ text, bold: false, italic: false }],
        source_pages: "",
      }));
  const items = source.flatMap((paragraph) => separateItems(paragraph, block.type));
  return (
    <View testID={`manual-body-${block.id}`} style={{ gap: 13 }}>
      {items.map((paragraph, index) => {
        const text = paragraph.runs.map((run) => run.text).join("");
        const number = paragraph.kind === "numbered"
          ? text.match(/^\s*(\d+[.)])\s+/)
          : null;
        const runs = number
          ? sliceRuns(paragraph.runs, number[0].length, text.length)
          : paragraph.runs;
        return (
          <View
            key={index}
            testID={`manual-item-${block.id}-${index}`}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              paddingLeft:
                paragraph.kind === "bullet" || paragraph.kind === "numbered"
                  ? 8
                  : 0,
            }}
          >
            {(paragraph.kind === "bullet" || number) && (
              <Text style={[s.articleBody, { minWidth: number ? 24 : 12 }]}>
                {number ? number[1] : "•"}{" "}
              </Text>
            )}
            <Text
              style={[
                s.articleBody,
                { flex: 1, marginTop: paragraph.kind === "subheading" ? 4 : 0 },
              ]}
            >
              {runs.map((run, runIndex) => (
                <Text
                  key={runIndex}
                  style={{
                    fontFamily: run.bold || paragraph.kind === "subheading"
                      ? "DMSans700" : "DMSans400",
                    fontStyle: run.italic ? "italic" : "normal",
                  }}
                >
                  {run.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
