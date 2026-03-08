export interface TextareaState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface InsertResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function wrapSelection(
  state: TextareaState,
  prefix: string,
  suffix: string,
  placeholder: string
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  if (selected) {
    // Check if already wrapped — toggle off
    if (
      before.endsWith(prefix) &&
      after.startsWith(suffix)
    ) {
      const newValue =
        before.slice(0, -prefix.length) + selected + after.slice(suffix.length);
      return {
        value: newValue,
        selectionStart: selectionStart - prefix.length,
        selectionEnd: selectionEnd - prefix.length,
      };
    }
    const newValue = before + prefix + selected + suffix + after;
    return {
      value: newValue,
      selectionStart: selectionStart + prefix.length,
      selectionEnd: selectionEnd + prefix.length,
    };
  }

  const newValue = before + prefix + placeholder + suffix + after;
  return {
    value: newValue,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionStart + prefix.length + placeholder.length,
  };
}

function toggleLinePrefix(
  state: TextareaState,
  prefix: string
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const line = value.slice(lineStart, end);

  const before = value.slice(0, lineStart);
  const after = value.slice(end);

  if (line.startsWith(prefix)) {
    const newLine = line.slice(prefix.length);
    return {
      value: before + newLine + after,
      selectionStart: Math.max(lineStart, selectionStart - prefix.length),
      selectionEnd: selectionEnd - prefix.length,
    };
  }

  const newLine = prefix + line;
  return {
    value: before + newLine + after,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

export function insertBold(state: TextareaState): InsertResult {
  return wrapSelection(state, "**", "**", "bold text");
}

export function insertItalic(state: TextareaState): InsertResult {
  return wrapSelection(state, "*", "*", "italic text");
}

export function insertStrikethrough(state: TextareaState): InsertResult {
  return wrapSelection(state, "~~", "~~", "strikethrough");
}

export function insertInlineCode(state: TextareaState): InsertResult {
  return wrapSelection(state, "`", "`", "code");
}

export function insertCodeBlock(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const content = selected || "code";
  const needsNewlineBefore = before.length > 0 && !before.endsWith("\n");
  const needsNewlineAfter = after.length > 0 && !after.startsWith("\n");
  const pre = needsNewlineBefore ? "\n" : "";
  const post = needsNewlineAfter ? "\n" : "";

  const newValue = `${before}${pre}\`\`\`\n${content}\n\`\`\`${post}${after}`;
  const codeStart = before.length + pre.length + 4; // after ```\n
  return {
    value: newValue,
    selectionStart: codeStart,
    selectionEnd: codeStart + content.length,
  };
}

export function insertLink(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  const text = selected || "link text";
  const newValue = `${before}[${text}](url)${after}`;
  const urlStart = before.length + 1 + text.length + 2; // after [text](
  return {
    value: newValue,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3, // select "url"
  };
}

export function insertHeading(
  state: TextareaState,
  level: 1 | 2 | 3
): InsertResult {
  const prefix = "#".repeat(level) + " ";
  return toggleLinePrefix(state, prefix);
}

export function insertBulletList(state: TextareaState): InsertResult {
  return toggleLinePrefix(state, "- ");
}

export function insertNumberedList(state: TextareaState): InsertResult {
  return toggleLinePrefix(state, "1. ");
}

export function insertBlockquote(state: TextareaState): InsertResult {
  return toggleLinePrefix(state, "> ");
}

export function insertCheckbox(state: TextareaState): InsertResult {
  return toggleLinePrefix(state, "- [ ] ");
}

export function insertHorizontalRule(state: TextareaState): InsertResult {
  const { value, selectionStart } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  const needsNewline = before.length > 0 && !before.endsWith("\n");
  const pre = needsNewline ? "\n" : "";
  const newValue = `${before}${pre}---\n${after}`;
  const cursor = before.length + pre.length + 4;
  return { value: newValue, selectionStart: cursor, selectionEnd: cursor };
}
