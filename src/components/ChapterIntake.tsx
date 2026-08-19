import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Chapter } from "../types";
import { createChapter } from "../utils/chapterImport";
import { isSafeProjectReference } from "../domain/projectReference";

interface ChapterIntakeProps {
  // Full existing chapter objects are needed for import planning.
  existingChapters: Chapter[];
  onCreate: (
    chapters: Chapter[],
    source: "manual-entry" | "csv-import" | "backup-import",
  ) => Promise<{ created: string[]; skipped: string[] }>;
}

const emptyForm = {
  id: "",
  title: "",
  contributorName: "",
  contributorEmail: "",
  institutionalAffiliation: "",
  leadEditor: "",
  folderUrl: "",
  submittedWordCount: "",
  abstractText: "",
  bioText: "",
};

export function ChapterIntake({
  existingChapters,
  onCreate,
}: ChapterIntakeProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contributorRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    idRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy]);

  const create = async () => {
    if (!form.id.trim() || !form.title.trim() || !form.contributorName.trim()) {
      setMessage("Chapter ID, title, and contributor name are required.");
      (!form.id.trim()
        ? idRef
        : !form.title.trim()
          ? titleRef
          : contributorRef
      ).current?.focus();
      return;
    }
    if (!isSafeProjectReference(form.folderUrl)) {
      setMessage(
        "Submission folder / URL must be HTTPS or a project-relative reference.",
      );
      folderRef.current?.focus();
      return;
    }
    const existingIds = existingChapters.map((c) => c.id);
    if (existingIds.includes(form.id.trim())) {
      setMessage(
        `Chapter ${form.id.trim()} already exists. Edit it from the chapter list instead.`,
      );
      idRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await onCreate([createChapter(form)], "manual-entry");
      if (!result.created.length) throw new Error("Chapter already exists.");
      setForm(emptyForm);
      setOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
      setMessage(`Chapter ${form.id.trim()} added.`);
    } catch {
      setMessage(
        "Could not save the chapter. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          ref={triggerRef}
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add chapter
        </button>
      </div>
      {message && !open && (
        <p className="mt-3 text-sm text-gray-600 text-right" role="status">
          {message}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="chapter-intake-title">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 id="chapter-intake-title" className="text-xl font-semibold text-gray-900">
                  Add chapter and contributor
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Progress is tracked on this chapter record.
                </p>
              </div>
              <button
                onClick={close}
                disabled={busy}
                aria-label="Close add chapter"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {message && (
                <p className="md:col-span-2 text-sm text-red-700" role="alert">
                  {message}
                </p>
              )}
              <Field
                inputRef={idRef}
                label="Chapter ID *"
                value={form.id}
                onChange={(value) => setForm({ ...form, id: value })}
                placeholder="e.g. CH14"
              />
              <Field
                label="Lead editor"
                value={form.leadEditor}
                onChange={(value) => setForm({ ...form, leadEditor: value })}
              />
              <Field
                inputRef={titleRef}
                label="Chapter title *"
                value={form.title}
                onChange={(value) => setForm({ ...form, title: value })}
                className="md:col-span-2"
              />
              <Field
                inputRef={contributorRef}
                label="Contributor name *"
                value={form.contributorName}
                onChange={(value) =>
                  setForm({ ...form, contributorName: value })
                }
              />
              <Field
                label="Contributor email"
                type="email"
                value={form.contributorEmail}
                onChange={(value) =>
                  setForm({ ...form, contributorEmail: value })
                }
              />
              <Field
                label="Institutional affiliation"
                value={form.institutionalAffiliation}
                onChange={(value) =>
                  setForm({ ...form, institutionalAffiliation: value })
                }
                className="md:col-span-2"
              />
              <Field
                inputRef={folderRef}
                label="Submission folder / URL"
                value={form.folderUrl}
                onChange={(value) => setForm({ ...form, folderUrl: value })}
                className="md:col-span-2"
              />
              <Field
                label="Word count"
                value={form.submittedWordCount}
                onChange={(value) =>
                  setForm({ ...form, submittedWordCount: value })
                }
              />
              <TextField
                label="Abstract"
                value={form.abstractText}
                onChange={(value) => setForm({ ...form, abstractText: value })}
              />
              <TextField
                label="Biography"
                value={form.bioText}
                onChange={(value) => setForm({ ...form, bioText: value })}
                className="md:col-span-2"
              />
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={close}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={create}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add chapter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
  type = "text",
  placeholder,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className={className}>
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </label>
  );
}
