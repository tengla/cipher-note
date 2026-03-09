import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  insertBold,
  insertItalic,
  insertStrikethrough,
  insertInlineCode,
  insertCodeBlock,
  insertLink,
  insertHeading,
  insertBulletList,
  insertNumberedList,
  insertBlockquote,
  insertCheckbox,
  type TextareaState,
} from "./toolbar-actions";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  CheckSquare,
  Eye,
  Pencil,
  Columns2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "write" | "preview" | "split";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function MarkdownEditor({
  name,
  defaultValue = "",
  placeholder,
  className,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(defaultValue);
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyAction = useCallback(
    (
      actionFn: (state: TextareaState) => {
        value: string;
        selectionStart: number;
        selectionEnd: number;
      }
    ) => {
      const el = textareaRef.current;
      const state: TextareaState = {
        value: el?.value ?? content,
        selectionStart: el?.selectionStart ?? content.length,
        selectionEnd: el?.selectionEnd ?? content.length,
      };
      const result = actionFn(state);
      setContent(result.value);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.value = result.value;
          ta.selectionStart = result.selectionStart;
          ta.selectionEnd = result.selectionEnd;
          ta.focus();
        }
      });
    },
    [content]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const handlers: Record<string, () => void> = {
        b: () => applyAction(insertBold),
        i: () => applyAction(insertItalic),
        k: () => applyAction(insertLink),
        e: () => applyAction(insertInlineCode),
      };

      const handler = handlers[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    },
    [applyAction]
  );

  const toolbarButtons = [
    { icon: Bold, action: insertBold, title: "Bold (Ctrl+B)" },
    { icon: Italic, action: insertItalic, title: "Italic (Ctrl+I)" },
    {
      icon: Strikethrough,
      action: insertStrikethrough,
      title: "Strikethrough",
    },
    "separator" as const,
    {
      icon: Heading1,
      action: (s: TextareaState) => insertHeading(s, 1),
      title: "Heading 1",
    },
    {
      icon: Heading2,
      action: (s: TextareaState) => insertHeading(s, 2),
      title: "Heading 2",
    },
    {
      icon: Heading3,
      action: (s: TextareaState) => insertHeading(s, 3),
      title: "Heading 3",
    },
    "separator" as const,
    { icon: List, action: insertBulletList, title: "Bullet list" },
    { icon: ListOrdered, action: insertNumberedList, title: "Numbered list" },
    { icon: CheckSquare, action: insertCheckbox, title: "Task list" },
    "separator" as const,
    {
      icon: Code,
      action: insertInlineCode,
      title: "Inline code (Ctrl+E)",
    },
    { icon: SquareCode, action: insertCodeBlock, title: "Code block" },
    { icon: Quote, action: insertBlockquote, title: "Blockquote" },
    { icon: Link, action: insertLink, title: "Link (Ctrl+K)" },
  ];

  const viewModes = [
    { mode: "write" as const, icon: Pencil, label: "Write" },
    { mode: "preview" as const, icon: Eye, label: "Preview" },
    { mode: "split" as const, icon: Columns2, label: "Split" },
  ];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Toolbar + Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 flex-wrap">
          {toolbarButtons.map((item, i) =>
            item === "separator" ? (
              <div key={i} className="w-px h-4 bg-border/40 mx-1" />
            ) : (
              <Button
                key={i}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground hover:bg-accent/50"
                onClick={() => applyAction(item.action)}
                title={item.title}
              >
                <item.icon className="w-3.5 h-3.5" />
              </Button>
            )
          )}
        </div>

        <div className="flex items-center gap-0.5 bg-background/30 rounded-md p-0.5 border border-border/30 shrink-0">
          {viewModes.map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-2 text-[11px] gap-1",
                viewMode === mode
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
              onClick={() => setViewMode(mode)}
            >
              <Icon className="w-3 h-3" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Editor / Preview */}
      <div className={cn(viewMode === "split" && "grid grid-cols-1 sm:grid-cols-2 gap-3")}>
        {(viewMode === "write" || viewMode === "split") && (
          <textarea
            ref={textareaRef}
            name={name}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex min-h-36 w-full resize-y rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary/50 transition-colors"
          />
        )}

        {(viewMode === "preview" || viewMode === "split") && (
          <div className="min-h-36 rounded-md border border-border/50 bg-background/30 p-3 overflow-auto">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-sm text-muted-foreground/40 italic">
                Nothing to preview
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hidden input for form submission when textarea is not rendered */}
      {viewMode === "preview" && (
        <input type="hidden" name={name} value={content} />
      )}
    </div>
  );
}
