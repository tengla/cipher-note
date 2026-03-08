import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import {
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Terminal,
  Eraser,
  Filter,
  KeyRound,
  ArrowLeft,
  Tags,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  addNote,
  getAllNotes,
  updateNote,
  deleteNote,
  getNotesByCategory,
  clearAllNotes,
  countNotes,
  getRawNote,
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  type Note,
  type Category,
} from "./db";

function getCategoryBadgeStyle(color: string) {
  return {
    background: `oklch(0.5 0.15 ${color} / 0.25)`,
    color: `oklch(0.78 0.14 ${color})`,
    border: `1px solid oklch(0.5 0.15 ${color} / 0.3)`,
  };
}

const HUE_PRESETS = [
  { label: "Purple", hue: "260" },
  { label: "Blue", hue: "200" },
  { label: "Pink", hue: "330" },
  { label: "Yellow", hue: "80" },
  { label: "Teal", hue: "160" },
  { label: "Red", hue: "25" },
  { label: "Orange", hue: "55" },
  { label: "Green", hue: "140" },
  { label: "Indigo", hue: "280" },
  { label: "Coral", hue: "15" },
];

function LogPanel({ logs }: { logs: string[] }) {
  return (
    <div className="glass-card rounded-xl p-4 font-mono text-[11px] max-h-44 overflow-y-auto">
      {logs.length === 0 ? (
        <span className="text-muted-foreground/60 flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          Awaiting operations...
        </span>
      ) : (
        <div className="flex flex-col gap-0.5">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`py-0.5 text-muted-foreground/80 ${i === logs.length - 1 ? "log-cursor" : ""}`}
            >
              <span className="text-primary/70 select-none mr-1.5">$</span>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
          {filtered ? (
            <Filter className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
          ) : (
            <KeyRound className="w-8 h-8 text-primary/30" strokeWidth={1.5} />
          )}
        </div>
        {!filtered && (
          <div className="glow-dot absolute -top-1 -right-1 animate-pulse" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/70">
          {filtered ? "No matching notes" : "Your vault is empty"}
        </p>
        <p className="text-xs text-muted-foreground/40 mt-1">
          {filtered
            ? "Try a different category filter"
            : "Create your first encrypted note"}
        </p>
      </div>
    </div>
  );
}

function CategoryEditor({
  categories,
  onClose,
  onChanged,
}: {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cats, setCats] = useState<Category[]>(categories);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("260");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError("Category already exists");
      return;
    }
    setError(null);
    const order = cats.length > 0 ? Math.max(...cats.map((c) => c.order)) + 1 : 0;
    const id = await addCategory({ name, color: newColor, order });
    setCats([...cats, { id, name, color: newColor, order }]);
    setNewName("");
    onChanged();
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id!);
    setEditName(cat.name);
    setEditColor(cat.color);
    setError(null);
  };

  const handleSaveEdit = async (cat: Category) => {
    const name = editName.trim();
    if (!name) return;
    if (cats.some((c) => c.id !== cat.id && c.name.toLowerCase() === name.toLowerCase())) {
      setError("Category name already taken");
      return;
    }
    setError(null);
    const updated = { ...cat, name, color: editColor };
    await updateCategory(updated);
    setCats(cats.map((c) => (c.id === cat.id ? updated : c)));
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (cat: Category) => {
    await deleteCategory(cat.id!);
    setCats(cats.filter((c) => c.id !== cat.id));
    onChanged();
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= cats.length) return;
    const updated = [...cats];
    const tempOrder = updated[index]!.order;
    updated[index] = { ...updated[index]!, order: updated[swapIndex]!.order };
    updated[swapIndex] = { ...updated[swapIndex]!, order: tempOrder };
    updated.sort((a, b) => a.order - b.order);
    setCats(updated);
    await reorderCategories(updated);
    onChanged();
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground hover:bg-accent/50"
          title="Back to notes"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
          <Tags className="w-3 h-3 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Manage Categories
        </span>
      </div>

      {error && (
        <p className="text-xs text-destructive mb-3">{error}</p>
      )}

      {/* Category list */}
      <div className="flex flex-col gap-1.5 mb-4">
        {cats.map((cat, index) => (
          <div
            key={cat.id}
            className="flex items-center gap-2 rounded-lg bg-background/30 px-3 py-2 border border-border/30"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-default"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === cats.length - 1}
                className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-default"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {editingId === cat.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs flex-1 bg-background/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(cat);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex gap-1">
                  {HUE_PRESETS.map((preset) => (
                    <button
                      key={preset.hue}
                      type="button"
                      onClick={() => setEditColor(preset.hue)}
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0 transition-transform"
                      style={{
                        background: `oklch(0.6 0.18 ${preset.hue})`,
                        transform: editColor === preset.hue ? "scale(1.3)" : "scale(1)",
                        boxShadow: editColor === preset.hue ? `0 0 6px oklch(0.6 0.18 ${preset.hue})` : "none",
                      }}
                      title={preset.label}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSaveEdit(cat)}
                  className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(null)}
                  className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span
                  className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5"
                  style={getCategoryBadgeStyle(cat.color)}
                >
                  {cat.name}
                </span>
                <span className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartEdit(cat)}
                  className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground hover:bg-accent/50"
                  title="Edit"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(cat)}
                  className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new category */}
      <div className="flex items-center gap-2 rounded-lg bg-background/20 px-3 py-2 border border-dashed border-border/40">
        <Plus className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category..."
          className="h-7 text-xs flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <div className="flex gap-1">
          {HUE_PRESETS.map((preset) => (
            <button
              key={preset.hue}
              type="button"
              onClick={() => setNewColor(preset.hue)}
              className="w-4 h-4 rounded-full border border-white/20 shrink-0 transition-transform"
              style={{
                background: `oklch(0.6 0.18 ${preset.hue})`,
                transform: newColor === preset.hue ? "scale(1.3)" : "scale(1)",
                boxShadow: newColor === preset.hue ? `0 0 6px oklch(0.6 0.18 ${preset.hue})` : "none",
              }}
              title={preset.label}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

type View = "list" | "detail" | "editor" | "categories";

export function NotesApp({ passphrase }: { passphrase: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [view, setView] = useState<View>("list");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [logs, setLogs] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rawContents, setRawContents] = useState<Record<number, string>>({});
  const [formRevision, setFormRevision] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const categoryColorMap = Object.fromEntries(
    categories.map((c) => [c.name, c.color])
  );
  const categoryNames = categories.map((c) => c.name);

  const log = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      let result: Note[];
      if (filterCategory === "all") {
        result = await getAllNotes(passphrase);
        log(`getAllNotes() → ${result.length} notes fetched & decrypted`);
      } else {
        result = await getNotesByCategory(filterCategory, passphrase);
        log(
          `getNotesByCategory("${filterCategory}") → ${result.length} notes fetched & decrypted`
        );
      }
      result.sort((a, b) => b.updatedAt - a.updatedAt);
      setNotes(result);

      const count = await countNotes();
      setTotalCount(count);
    } catch (err) {
      log(`Error loading notes: ${err}`);
    }
  }, [filterCategory, passphrase, log]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = (formData.get("title") as string).trim();
    const content = (formData.get("content") as string).trim();
    const category = formData.get("category") as string;

    if (!title) return;

    try {
      if (editingNote) {
        const updated: Note = {
          ...editingNote,
          title,
          content,
          category,
          updatedAt: Date.now(),
        };
        await updateNote(updated, passphrase);
        log(
          `updateNote(${updated.id}) → Encrypted & updated "${title}" [${category}]`
        );
      } else {
        const now = Date.now();
        const id = await addNote({
          title,
          content,
          category,
          createdAt: now,
          updatedAt: now,
        }, passphrase);
        log(`addNote() → Encrypted & stored "${title}" with id=${id} [${category}]`);
      }
      closeEditor();
      await loadNotes();
    } catch (err) {
      log(`Error saving note: ${err}`);
    }
  };

  const handleDelete = async (note: Note) => {
    try {
      await deleteNote(note.id!);
      log(`deleteNote(${note.id}) → Deleted "${note.title}"`);
      if (editingNote?.id === note.id) closeEditor();
      if (viewingNote?.id === note.id) closeDetail();
      await loadNotes();
    } catch (err) {
      log(`Error deleting note: ${err}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotes();
      log(`clearAllNotes() → All notes deleted`);
      closeEditor();
      await loadNotes();
    } catch (err) {
      log(`Error clearing notes: ${err}`);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setView("editor");
    setFormRevision((r) => r + 1);
    log(`Editing note id=${note.id}: "${note.title}"`);
  };

  const handleNewNote = () => {
    setEditingNote(null);
    setView("editor");
    setFormRevision((r) => r + 1);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setView("detail");
    log(`Viewing note id=${note.id}: "${note.title}"`);
  };

  const closeEditor = () => {
    setEditingNote(null);
    setView("list");
    setFormRevision((r) => r + 1);
  };

  const closeDetail = () => {
    setViewingNote(null);
    setView("list");
  };

  const handleShowRaw = async (note: Note) => {
    const id = note.id!;
    if (rawContents[id]) {
      setRawContents((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      log(`Hiding raw encrypted content for note id=${id}`);
      return;
    }
    try {
      const raw = await getRawNote(id);
      if (raw) {
        setRawContents((prev) => ({ ...prev, [id]: raw.content }));
        log(`getRawNote(${id}) → showing encrypted ciphertext from IndexedDB`);
      }
    } catch (err) {
      log(`Error fetching raw note: ${err}`);
    }
  };

  // Detail view — shown when viewing a note
  if (view === "detail" && viewingNote) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeDetail}
                className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground hover:bg-accent/50"
                title="Back to notes"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span
                className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5"
                style={getCategoryBadgeStyle(categoryColorMap[viewingNote.category] ?? "260")}
              >
                {viewingNote.category}
              </span>
            </div>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleShowRaw(viewingNote)}
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                title={rawContents[viewingNote.id!] ? "Hide encrypted" : "Show encrypted"}
              >
                {rawContents[viewingNote.id!] ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(viewingNote)}
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(viewingNote)}
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-foreground mb-1">
            {viewingNote.title}
          </h2>
          <p className="text-[11px] text-muted-foreground/50 font-mono mb-4">
            {new Date(viewingNote.updatedAt).toLocaleString()}
          </p>

          {viewingNote.content && (
            <MarkdownRenderer
              content={viewingNote.content}
              className="text-muted-foreground/80"
            />
          )}

          {rawContents[viewingNote.id!] && (
            <div className="rounded-lg bg-background/60 border border-primary/10 p-3 mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">
                  AES-256-GCM Ciphertext
                </span>
              </div>
              <p className="text-[11px] font-mono text-primary/40 break-all leading-relaxed select-all">
                {rawContents[viewingNote.id!]}
              </p>
            </div>
          )}
        </div>

        {/* Operation Log */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Operation Log
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="h-6 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
            >
              Clear
            </Button>
          </div>
          <LogPanel logs={logs} />
        </div>
      </div>
    );
  }

  // Editor view — shown exclusively when composing or editing
  if (view === "editor") {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeEditor}
              className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-foreground hover:bg-accent/50"
              title="Back to notes"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
              {editingNote ? (
                <Pencil className="w-3 h-3 text-primary" />
              ) : (
                <Plus className="w-3 h-3 text-primary" />
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {editingNote ? "Edit Note" : "New Note"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="title" className="sr-only">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Note title..."
                  defaultValue={editingNote?.title ?? ""}
                  key={`title-${editingNote?.id ?? "new"}-${formRevision}`}
                  required
                  autoFocus
                  className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                />
              </div>
              <Label htmlFor="category" className="sr-only">
                Category
              </Label>
              <Select
                name="category"
                defaultValue={editingNote?.category ?? "General"}
                key={`cat-${editingNote?.id ?? "new"}-${formRevision}`}
              >
                <SelectTrigger className="w-[130px] bg-background/50 border-border/50" id="category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent align="start">
                  {categoryNames.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <MarkdownEditor
              name="content"
              placeholder="Write your note in markdown..."
              defaultValue={editingNote?.content ?? ""}
              key={`content-${editingNote?.id ?? "new"}-${formRevision}`}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 gap-2 font-semibold">
                {editingNote ? (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Update Note
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Encrypt & Store
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={closeEditor} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Operation Log */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Operation Log
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="h-6 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
            >
              Clear
            </Button>
          </div>
          <LogPanel logs={logs} />
        </div>
      </div>
    );
  }

  // Categories view
  if (view === "categories") {
    return (
      <div className="flex flex-col gap-6 w-full">
        <CategoryEditor
          categories={categories}
          onClose={() => setView("list")}
          onChanged={() => loadCategories()}
        />

        {/* Operation Log */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Operation Log
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="h-6 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
            >
              Clear
            </Button>
          </div>
          <LogPanel logs={logs} />
        </div>
      </div>
    );
  }

  // List view — notes list with "New Note" button
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleNewNote}
          className="gap-2 font-semibold flex-1"
        >
          <Plus className="w-4 h-4" />
          New Note
        </Button>
        <Button
          variant="outline"
          onClick={() => setView("categories")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Tags className="w-4 h-4" />
          Categories
        </Button>
      </div>

      {/* Filter & Stats Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-background/30 border-border/40" id="filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Notes</SelectItem>
              {categoryNames.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground/60 font-mono tabular-nums">
            {totalCount} note{totalCount !== 1 ? "s" : ""} encrypted
          </span>
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1"
            >
              <Eraser className="w-3 h-3" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <EmptyState filtered={filterCategory !== "all"} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notes.map((note, index) => (
            <button
              key={note.id}
              type="button"
              onClick={() => handleViewNote(note)}
              className="note-card-enter glass-card rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-300 hover:border-primary/20 text-left w-full cursor-pointer"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span
                className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 shrink-0"
                style={getCategoryBadgeStyle(categoryColorMap[note.category] ?? "260")}
              >
                {note.category}
              </span>
              <h3 className="text-sm font-semibold text-foreground truncate flex-1">
                {note.title}
              </h3>
              <span className="text-[11px] text-muted-foreground/40 font-mono shrink-0">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Operation Log */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Operation Log
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLogs([])}
            className="h-6 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
          >
            Clear
          </Button>
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}
