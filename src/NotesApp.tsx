import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileText,
  Eraser,
  Filter,
  KeyRound,
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
  type Note,
} from "./db";

const CATEGORIES = ["General", "Work", "Personal", "Ideas", "Todo"];

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  General: "badge-general",
  Work: "badge-work",
  Personal: "badge-personal",
  Ideas: "badge-ideas",
  Todo: "badge-todo",
};

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
            : "Create your first encrypted note above"}
        </p>
      </div>
    </div>
  );
}

export function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [logs, setLogs] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rawContents, setRawContents] = useState<Record<number, string>>({});

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
        result = await getAllNotes();
        log(`getAllNotes() → ${result.length} notes fetched & decrypted`);
      } else {
        result = await getNotesByCategory(filterCategory);
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
  }, [filterCategory, log]);

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
        await updateNote(updated);
        log(
          `updateNote(${updated.id}) → Encrypted & updated "${title}" [${category}]`
        );
        setEditingNote(null);
      } else {
        const now = Date.now();
        const id = await addNote({
          title,
          content,
          category,
          createdAt: now,
          updatedAt: now,
        });
        log(`addNote() → Encrypted & stored "${title}" with id=${id} [${category}]`);
      }
      form.reset();
      await loadNotes();
    } catch (err) {
      log(`Error saving note: ${err}`);
    }
  };

  const handleDelete = async (note: Note) => {
    try {
      await deleteNote(note.id!);
      log(`deleteNote(${note.id}) → Deleted "${note.title}"`);
      if (editingNote?.id === note.id) setEditingNote(null);
      await loadNotes();
    } catch (err) {
      log(`Error deleting note: ${err}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotes();
      log(`clearAllNotes() → All notes deleted`);
      setEditingNote(null);
      await loadNotes();
    } catch (err) {
      log(`Error clearing notes: ${err}`);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    log(`Editing note id=${note.id}: "${note.title}"`);
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

  const cancelEdit = () => {
    setEditingNote(null);
    log("Edit cancelled");
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Compose Form */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
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
                key={editingNote?.id ?? "new"}
                required
                className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <Label htmlFor="category" className="sr-only">
              Category
            </Label>
            <Select
              name="category"
              defaultValue={editingNote?.category ?? "General"}
              key={`cat-${editingNote?.id ?? "new"}`}
            >
              <SelectTrigger className="w-[130px] bg-background/50 border-border/50" id="category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent align="start">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label htmlFor="content" className="sr-only">
            Content
          </Label>
          <Textarea
            id="content"
            name="content"
            placeholder="Note content..."
            className="min-h-20 resize-y bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
            defaultValue={editingNote?.content ?? ""}
            key={`content-${editingNote?.id ?? "new"}`}
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
            {editingNote && (
              <Button type="button" variant="outline" onClick={cancelEdit} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </form>
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
              {CATEGORIES.map((cat) => (
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
        <div className="flex flex-col gap-3">
          {notes.map((note, index) => (
            <div
              key={note.id}
              className={`note-card-enter glass-card rounded-xl overflow-hidden transition-all duration-300 ${
                editingNote?.id === note.id
                  ? "editing-pulse ring-1 ring-primary/40"
                  : "hover:border-primary/20"
              }`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Card Header */}
              <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${CATEGORY_BADGE_CLASS[note.category] ?? "badge-general"}`}
                    >
                      {note.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {note.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">
                    {new Date(note.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShowRaw(note)}
                    className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                    title={rawContents[note.id!] ? "Hide encrypted" : "Show encrypted"}
                  >
                    {rawContents[note.id!] ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(note)}
                    className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(note)}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Card Body */}
              {(note.content || rawContents[note.id!]) && (
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  {note.content && (
                    <p className="text-sm text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  )}
                  {rawContents[note.id!] && (
                    <div className="rounded-lg bg-background/60 border border-primary/10 p-3 mt-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ShieldCheck className="w-3 h-3 text-primary/60" />
                        <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">
                          AES-256-GCM Ciphertext
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-primary/40 break-all leading-relaxed select-all">
                        {rawContents[note.id!]}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
