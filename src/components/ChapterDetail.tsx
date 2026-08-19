import React, { useState, useEffect, useRef } from "react";
import { Chapter, ChapterStageRecord } from "../types";
import { X, Save } from "lucide-react";
import { StageIntakeDialog } from "./StageIntakeDialog";
import { StageHistory } from "./StageHistory";
import { isSafeProjectReference } from "../domain/projectReference";
import { deriveChapterProgress } from "../domain/chapterProgress";
import { formatStageEffectiveDate, stageLabel } from "../domain/chapterStageHistory";

/** Props for the ChapterDetail component. */
interface ChapterDetailProps {
  /** The chapter to edit, or null to create a new one. */
  chapter: Chapter | null;
  /** Callback to close the detail view. */
  onClose: () => void;
  /** Callback to persist the chapter (should handle Firestore transaction). */
  onSave: (chapter: Chapter) => Promise<{ chapter: Chapter; unchanged: boolean }>;
  onAppendStageRecord: (
    chapterId: string,
    record: ChapterStageRecord,
    expectedRevision: number,
  ) => Promise<Chapter>;
  onVoidStageRecord: (
    chapterId: string,
    recordId: string,
    reason: string,
    expectedRevision: number,
  ) => Promise<Chapter>;
  /** Email of the current user, used for recording submission metadata. */
  userEmail?: string;
  canEdit?: boolean;
}

/**
 * ChapterDetail renders a form for editing a chapter and provides a button to
 * open the manual submission intake dialog.
 */
export function ChapterDetail({
  chapter,
  onClose,
  onSave,
  onAppendStageRecord,
  onVoidStageRecord,
  userEmail,
  canEdit = true,
}: ChapterDetailProps) {
  const [formData, setFormData] = useState<Chapter | null>(null);
  const [lastSavedChapter, setLastSavedChapter] = useState<Chapter | null>(null);
  const [conflict, setConflict] = useState<{ current: Chapter } | null>(null);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Initialise form data from the supplied chapter.
  useEffect(() => {
    if (chapter) {
      setFormData({ ...chapter });
      setLastSavedChapter({ ...chapter });
    } else {
      setFormData(null);
      setLastSavedChapter(null);
    }
  }, [chapter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && !showSubmissionDialog && !conflict)
        onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, showSubmissionDialog, conflict, onClose]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [chapter.id]);

  if (!formData) return null;

  const editableKeys = Array.from(new Set([
    ...Object.keys(formData),
    ...Object.keys(lastSavedChapter ?? {}),
  ])).filter(key => !['id', 'dataRevision', 'updatedAt', 'updatedBy', 'submissions'].includes(key));
  const hasEditableChanges = editableKeys.some(key => {
    const current = (formData as unknown as Record<string, unknown>)[key] ?? '';
    const saved = (lastSavedChapter as unknown as Record<string, unknown> | null)?.[key] ?? '';
    return current !== saved;
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setFormData((prev) => {
      if (!prev) return null;
      return { ...(prev as any), [name]: value } as Chapter;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !hasEditableChanges) return;
    if (!formData.title.trim()) {
      setMessageIsError(true);
      setMessage("Nothing was changed. Enter a chapter title and try again.");
      titleRef.current?.focus();
      return;
    }
    if (
      !isSafeProjectReference(formData.folderUrl || "") ||
      !isSafeProjectReference(formData.feedbackLink || "")
    ) {
      setMessageIsError(true);
      setMessage(
        "Nothing was changed. Folder and feedback references must be HTTPS or project-relative.",
      );
      (!isSafeProjectReference(formData.folderUrl || "")
        ? folderRef
        : feedbackRef
      ).current?.focus();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await onSave(formData);
      setFormData(result.chapter);
      setLastSavedChapter(result.chapter);
      setMessageIsError(false);
      setMessage(result.unchanged ? "No chapter fields changed." : "Changes saved.");
    } catch (error) {
      if ((error as any)?.kind === "conflict") {
        setConflict({ current: (error as any).current });
      } else {
        setMessageIsError(true);
        setMessage(
          "Nothing was changed. Check the chapter details and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddSubmission = async (
    submission: ChapterStageRecord,
  ): Promise<{ ok: boolean; message?: string }> => {
    if (!formData)
      return {
        ok: false,
        message: "Nothing was saved — reload the latest chapter and try again.",
      };
    setBusy(true);
    setMessage(null);
    try {
      const saved = await onAppendStageRecord(
        formData.id,
        submission,
        formData.dataRevision ?? 0,
      );
      setFormData(saved);
      setLastSavedChapter(saved);
      setMessageIsError(false);
      setMessage("Stage record added — no further save is needed.");
      return { ok: true };
    } catch (error) {
      if ((error as any)?.kind === "duplicate")
        return {
          ok: false,
          message: "This exact file is already recorded for this chapter",
        };
      if ((error as any)?.kind === "stage-conflict") {
        const existing = (error as any).conflictingRecords?.[0] as ChapterStageRecord | undefined;
        return {
          ok: false,
          message: existing
            ? `Nothing was saved. This chapter already has an active ${stageLabel(existing)} record dated ${formatStageEffectiveDate(existing.effectiveOn)}. Resolve that record or choose another stage.`
            : "Nothing was saved. Resolve the active stage conflict or choose another stage.",
        };
      }
      if ((error as any)?.kind === "conflict") {
        setConflict({ current: (error as any).current });
        return {
          ok: false,
          message:
            "Nothing was saved — reload the latest chapter and try again",
        };
      } else {
        return {
          ok: false,
          message:
            "Nothing was saved — reload the latest chapter and try again",
        };
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVoidStage = async (
    recordId: string,
    reason: string,
  ): Promise<{ ok: boolean; message?: string }> => {
    if (!formData)
      return {
        ok: false,
        message:
          "Nothing was changed. Reload the latest chapter and try again.",
      };
    try {
      const saved = await onVoidStageRecord(
        formData.id,
        recordId,
        reason,
        formData.dataRevision ?? 0,
      );
      setFormData(saved);
      setLastSavedChapter(saved);
      setMessageIsError(false);
      setMessage("Stage record marked as entered by mistake.");
      return { ok: true };
    } catch (error) {
      if ((error as any)?.kind === "conflict")
        setConflict({ current: (error as any).current });
      return {
        ok: false,
        message:
          "Nothing was changed. Reload the latest chapter and try again.",
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="chapter-detail-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 id="chapter-detail-title" className="text-xl font-semibold text-gray-900">
            Chapter Detail
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close chapter"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <StageHistory
            records={formData.submissions}
            conflictRecordIds={deriveChapterProgress(formData).discrepancies.flatMap(discrepancy => discrepancy.code === 'duplicate-active-rank' ? discrepancy.recordIds ?? [] : [])}
            canEdit={canEdit}
            onVoid={handleVoidStage}
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSubmissionDialog(true)}
              className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Add stage file
            </button>
          )}
          <form
            id="chapter-form"
            onSubmit={handleSubmit}
            className={!canEdit ? "pointer-events-none opacity-80" : ""}
          >
            {message && (
              <p
                role={messageIsError ? "alert" : "status"}
                className={`mb-4 text-sm ${messageIsError ? "text-red-700" : "text-green-700"}`}
              >
                {message}
              </p>
            )}
            <section className="mb-8">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="md:col-span-2 block text-sm font-medium text-gray-700">
                  Chapter title
                  <input
                    ref={titleRef}
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Contributors
                  <input
                    type="text"
                    name="contributorName"
                    value={formData.contributorName}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                  <input
                    type="email"
                    name="contributorEmail"
                    value={formData.contributorEmail}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="md:col-span-2 block text-sm font-medium text-gray-700">
                  Affiliation
                  <input
                    type="text"
                    name="institutionalAffiliation"
                    value={formData.institutionalAffiliation || ""}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="md:col-span-2 block text-sm font-medium text-gray-700">
                  Submission folder / reference
                  <input
                    ref={folderRef}
                    type="text"
                    name="folderUrl"
                    value={formData.folderUrl || ""}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Lead editor
                  <input
                    type="text"
                    name="leadEditor"
                    value={formData.leadEditor || ""}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Contact person
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson || ""}
                    onChange={handleChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
              </div>
            </section>
            {/* Begin chapter fields */}
            <SelectField
              label="Initial Abstract"
              name="initialAbstractSubmitted"
              value={formData.initialAbstractSubmitted || ""}
              onChange={handleChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Abstract Revision
              </label>
              <input
                type="text"
                placeholder="e.g. Rev00"
                name="abstractRevision"
                value={formData.abstractRevision || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="hidden md:block"></div>
            <SelectField
              label="Updated Abstract"
              name="updatedAbstractSubmitted"
              value={formData.updatedAbstractSubmitted || ""}
              onChange={handleChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Updated Abstract Date
              </label>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                name="updatedAbstractDate"
                value={formData.updatedAbstractDate || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="hidden md:block"></div>
            <SelectField
              label="Initial Chapter"
              name="initialChapterSubmission"
              value={formData.initialChapterSubmission || ""}
              onChange={handleChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter Revision
              </label>
              <input
                type="text"
                placeholder="e.g. Rev00"
                name="chapterRevision"
                value={formData.chapterRevision || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Chapter Date
              </label>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                name="initialChapterDate"
                value={formData.initialChapterDate || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Word Count
              </label>
              <input
                type="text"
                name="submittedWordCount"
                value={formData.submittedWordCount || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <SelectField
              label="Biographical Statement"
              name="biographicalStatement"
              value={formData.biographicalStatement || ""}
              onChange={handleChange}
            />
            {/* Content Texts */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Content Texts
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abstract Text
                  </label>
                  <textarea
                    name="abstractText"
                    rows={4}
                    value={formData.abstractText || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Biographical Statement Text
                  </label>
                  <textarea
                    name="bioText"
                    rows={4}
                    value={formData.bioText || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  ></textarea>
                </div>
              </div>
            </section>
            {/* Feedback & Revisions */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Feedback & Revisions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField
                  label="Feedback Received"
                  name="feedbackReceived"
                  value={formData.feedbackReceived || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Feedback Received
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="dateFeedbackReceived"
                    value={formData.dateFeedbackReceived || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="hidden md:block"></div>
                <SelectField
                  label="Feedback Sent"
                  name="feedbackSent"
                  value={formData.feedbackSent || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feedback Revision
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rev00"
                    name="feedbackRevision"
                    value={formData.feedbackRevision || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Feedback Sent
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="dateFeedbackSent"
                    value={formData.dateFeedbackSent || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feedback Link
                  </label>
                  <input
                    ref={feedbackRef}
                    type="text"
                    name="feedbackLink"
                    value={formData.feedbackLink || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <SelectField
                  label="Revision 01 Submitted"
                  name="revision01Submitted"
                  value={formData.revision01Submitted || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Revision 01
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="dateRevision01Submitted"
                    value={formData.dateRevision01Submitted || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </section>
            {/* Submission Versions */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Submission Versions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Manuscript Submission"
                  name="manuscriptSubmission"
                  value={formData.manuscriptSubmission || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manuscript Submission Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="manuscriptSubmissionDate"
                    value={formData.manuscriptSubmissionDate || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <SelectField
                  label="Publisher Submission"
                  name="publisherSubmission"
                  value={formData.publisherSubmission || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Publisher Submission Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="publisherSubmissionDate"
                    value={formData.publisherSubmissionDate || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <SelectField
                  label="Typeset Submission"
                  name="typesetSubmission"
                  value={formData.typesetSubmission || ""}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typeset Submission Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="typesetSubmissionDate"
                    value={formData.typesetSubmissionDate || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </section>
            {/* Follow-ups */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Follow-ups
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField
                  label="Follow-up Initial Sub"
                  name="followUpForInitialSubmission"
                  value={formData.followUpForInitialSubmission}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="followUpDate"
                    value={formData.followUpDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <SelectField
                  label="Follow-up Contacted"
                  name="followUpContacted"
                  value={formData.followUpContacted}
                  onChange={handleChange}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Contacted
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    name="dateFollowUpContacted"
                    value={formData.dateFollowUpContacted}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-5"
                  />
                </div>
              </div>
            </section>
            {/* Finalization */}
            <section>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">
                Finalization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField
                  label="Decision To Proceed"
                  name="decisionToProceed"
                  value={formData.decisionToProceed}
                  onChange={handleChange}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason If No
                  </label>
                  <input
                    type="text"
                    name="reasonIfNo"
                    value={formData.reasonIfNo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-5"
                  />
                </div>
                <SelectField
                  label="Image List Submitted"
                  name="imageListSubmitted"
                  value={formData.imageListSubmitted}
                  onChange={handleChange}
                />
                <SelectField
                  label="Images Meet QC"
                  name="imagesMeetQc"
                  value={formData.imagesMeetQc}
                  onChange={handleChange}
                />
                <SelectField
                  label="Indexing Terms"
                  name="indexingTermsSubmitted"
                  value={formData.indexingTermsSubmitted}
                  onChange={handleChange}
                />
              </div>
            </section>
          </form>
        </div>
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          {canEdit && (
            <button
              type="submit"
              form="chapter-form"
              disabled={busy || !hasEditableChanges}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {busy ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
      {/* Submission intake dialog */}
      {showSubmissionDialog && (
        <StageIntakeDialog
          onAdd={handleAddSubmission}
          onClose={() => setShowSubmissionDialog(false)}
          recordedBy={userEmail ?? ""}
        />
      )}
      {/* Conflict overlay */}
      {conflict && (
        <ConflictOverlay
          current={conflict.current}
          onReload={() => {
            setFormData(conflict.current);
            setConflict(null);
            setShowSubmissionDialog(false);
            setMessageIsError(false);
            setMessage(
              "Latest chapter loaded. Your unsaved changes were not saved.",
            );
          }}
          onCancel={onClose}
        />
      )}
    </div>
  );
}

/** Conflict overlay component (shown when a concurrent edit is detected) */
function ConflictOverlay({
  current,
  onReload,
  onCancel,
}: {
  current: Chapter;
  onReload: () => void;
  onCancel: () => void;
}) {
  const reloadRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    reloadRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        className="bg-white rounded-2xl shadow-xl p-6 max-w-md"
      >
        <h2
          id="conflict-title"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Conflict Detected
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This chapter changed after you opened it. Review the latest version
          before saving again.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            ref={reloadRef}
            onClick={onReload}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Reload latest
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple select field component used throughout the form. */
function SelectField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
      >
        <option value="">Select...</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="N/A">N/A</option>
      </select>
    </div>
  );
}
