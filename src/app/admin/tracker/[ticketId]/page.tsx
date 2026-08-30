'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Check, ClipboardList, Link2, Loader2, MessageSquare, Paperclip, Plus, Save, Trash2 } from 'lucide-react';
import {
  adminApi,
  getApiErrorMessage,
  TrackerChecklistItem,
  TrackerPerson,
  TrackerProductArea,
  TrackerTicketDetails,
  TrackerTicketPriority,
  TrackerTicketStatus,
  TrackerTicketType,
  TrackerTicketWriteInput,
} from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';

type DraftForm = {
  productArea: TrackerProductArea;
  title: string;
  summary: string;
  ticketType: TrackerTicketType;
  priority: TrackerTicketPriority;
  status: TrackerTicketStatus;
  assigneeId: string;
  dueDate: string;
  description: string;
  acceptanceCriteria: string;
  notes: string;
  blockerReason: string;
  releaseTarget: string;
  externalLinksJson: string;
  metadataJson: string;
  sortOrder: string;
};

const emptyDraft = (productArea: TrackerProductArea): DraftForm => ({
  productArea,
  title: '',
  summary: '',
  ticketType: 'BUG',
  priority: 'MEDIUM',
  status: 'TODO',
  assigneeId: '',
  dueDate: '',
  description: '',
  acceptanceCriteria: '',
  notes: '',
  blockerReason: '',
  releaseTarget: '',
  externalLinksJson: '[]',
  metadataJson: '{}',
  sortOrder: '0',
});

const personLabel = (person: TrackerPerson | null) => {
  if (!person) return 'Unassigned';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || person.id;
};

const formatDateInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const parseDateInput = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return 'null';
  }
};

export default function TrackerTicketPage() {
  const params = useParams<{ ticketId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = params.ticketId;
  const isNew = ticketId === 'new';
  const initialArea = (searchParams.get('area') === 'MOBILE_APP' ? 'MOBILE_APP' : 'WEBAPP') as TrackerProductArea;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState<TrackerTicketDetails | null>(null);
  const [assignees, setAssignees] = useState<TrackerPerson[]>([]);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft(initialArea));
  const [commentBody, setCommentBody] = useState('');
  const [attachmentDraft, setAttachmentDraft] = useState({ label: '', url: '', mimeType: '', sizeBytes: '' });
  const [checklistDraft, setChecklistDraft] = useState({ label: '', sortOrder: '0' });

  const canMutateChildren = !isNew && Boolean(ticket);

  useEffect(() => {
    setDraft((current) => (isNew ? emptyDraft(initialArea) : current));
  }, [initialArea, isNew]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [usersResponse, ticketResponse] = await Promise.all([
        adminApi.getUsers({ limit: 200 }),
        isNew ? Promise.resolve(null) : adminApi.getTrackerTicket(ticketId),
      ]);

      setAssignees(usersResponse.data.users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName ?? null,
        email: user.email,
        avatarUrl: null,
      })));

      if (ticketResponse?.data) {
        setTicket(ticketResponse.data);
        setDraft({
          productArea: ticketResponse.data.productArea,
          title: ticketResponse.data.title,
          summary: ticketResponse.data.summary || '',
          ticketType: ticketResponse.data.ticketType,
          priority: ticketResponse.data.priority,
          status: ticketResponse.data.status,
          assigneeId: ticketResponse.data.assigneeId || '',
          dueDate: formatDateInput(ticketResponse.data.dueDate),
          description: ticketResponse.data.description || '',
          acceptanceCriteria: ticketResponse.data.acceptanceCriteria || '',
          notes: ticketResponse.data.notes || '',
          blockerReason: ticketResponse.data.blockerReason || '',
          releaseTarget: ticketResponse.data.releaseTarget || '',
          externalLinksJson: safeJsonStringify(ticketResponse.data.externalLinksJson),
          metadataJson: safeJsonStringify(ticketResponse.data.metadataJson),
          sortOrder: String(ticketResponse.data.sortOrder ?? 0),
        });
      } else if (isNew) {
        setTicket(null);
        setDraft(emptyDraft(initialArea));
      }
    } catch (error: unknown) {
      showError('Could not load ticket', getApiErrorMessage(error, 'Failed to load tracker ticket'));
    } finally {
      setLoading(false);
    }
  }

  const activityCounts = useMemo(() => {
    if (!ticket) {
      return { comments: 0, attachments: 0, checklist: 0 };
    }
    return {
      comments: ticket.comments.length,
      attachments: ticket.attachments.length,
      checklist: ticket.checklistItems.length,
    };
  }, [ticket]);

  async function saveTicket() {
    setSaving(true);
    try {
      const payload: TrackerTicketWriteInput = {
        productArea: draft.productArea,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        ticketType: draft.ticketType,
        priority: draft.priority,
        status: draft.status,
        assigneeId: draft.assigneeId || null,
        dueDate: parseDateInput(draft.dueDate),
        description: draft.description.trim() || null,
        acceptanceCriteria: draft.acceptanceCriteria.trim() || null,
        notes: draft.notes.trim() || null,
        blockerReason: draft.blockerReason.trim() || null,
        releaseTarget: draft.releaseTarget.trim() || null,
        externalLinksJson: parseJsonField(draft.externalLinksJson, 'External links'),
        metadataJson: parseJsonField(draft.metadataJson, 'Metadata'),
        sortOrder: Number(draft.sortOrder || 0),
      };

      if (!payload.title) {
        throw new Error('Title is required');
      }

      if (isNew) {
        const response = await adminApi.createTrackerTicket(payload);
        showSuccess('Tracker ticket created', 'The ticket has been added to the tracker.');
        router.replace(`/admin/tracker/${response.data.id}`);
        router.refresh();
        return;
      }

      const response = await adminApi.updateTrackerTicket(ticketId, payload);
      setTicket(response.data);
      setDraft({
        productArea: response.data.productArea,
        title: response.data.title,
        summary: response.data.summary || '',
        ticketType: response.data.ticketType,
        priority: response.data.priority,
        status: response.data.status,
        assigneeId: response.data.assigneeId || '',
        dueDate: formatDateInput(response.data.dueDate),
        description: response.data.description || '',
        acceptanceCriteria: response.data.acceptanceCriteria || '',
        notes: response.data.notes || '',
        blockerReason: response.data.blockerReason || '',
        releaseTarget: response.data.releaseTarget || '',
        externalLinksJson: safeJsonStringify(response.data.externalLinksJson),
        metadataJson: safeJsonStringify(response.data.metadataJson),
        sortOrder: String(response.data.sortOrder ?? 0),
      });
      showSuccess('Tracker ticket saved', 'Changes were written to the tracker.');
    } catch (error: unknown) {
      showError('Could not save ticket', getApiErrorMessage(error, 'Failed to save tracker ticket'));
    } finally {
      setSaving(false);
    }
  }

  async function refreshTicket() {
    if (!ticket || isNew) return;
    try {
      const response = await adminApi.getTrackerTicket(ticketId);
      setTicket(response.data);
    } catch (error: unknown) {
      showError('Could not refresh ticket', getApiErrorMessage(error, 'Failed to refresh tracker ticket'));
    }
  }

  async function addComment() {
    const body = commentBody.trim();
    if (!body || !canMutateChildren) return;
    try {
      await adminApi.addTrackerComment(ticketId, body);
      setCommentBody('');
      await refreshTicket();
      showSuccess('Comment added', 'The update was appended to the ticket timeline.');
    } catch (error: unknown) {
      showError('Could not add comment', getApiErrorMessage(error, 'Failed to add tracker comment'));
    }
  }

  async function addAttachment() {
    if (!canMutateChildren) return;
    const label = attachmentDraft.label.trim();
    const url = attachmentDraft.url.trim();
    if (!label || !url) {
      showError('Missing attachment data', 'Provide both a label and a URL.');
      return;
    }

    try {
      await adminApi.addTrackerAttachment(ticketId, {
        label,
        url,
        mimeType: attachmentDraft.mimeType.trim() || null,
        sizeBytes: attachmentDraft.sizeBytes ? Number(attachmentDraft.sizeBytes) : null,
      });
      setAttachmentDraft({ label: '', url: '', mimeType: '', sizeBytes: '' });
      await refreshTicket();
      showSuccess('Attachment added', 'The file reference is now attached to the ticket.');
    } catch (error: unknown) {
      showError('Could not add attachment', getApiErrorMessage(error, 'Failed to add tracker attachment'));
    }
  }

  async function addChecklistItem() {
    if (!canMutateChildren) return;
    const label = checklistDraft.label.trim();
    if (!label) return;

    try {
      await adminApi.addTrackerChecklistItem(ticketId, {
        label,
        sortOrder: Number(checklistDraft.sortOrder || 0),
      });
      setChecklistDraft({ label: '', sortOrder: '0' });
      await refreshTicket();
      showSuccess('Checklist item added', 'A new task item was added to the ticket.');
    } catch (error: unknown) {
      showError('Could not add checklist item', getApiErrorMessage(error, 'Failed to add checklist item'));
    }
  }

  async function toggleChecklistItem(item: TrackerChecklistItem) {
    if (!canMutateChildren) return;
    try {
      await adminApi.updateTrackerChecklistItem(ticketId, item.id, { done: !item.done });
      await refreshTicket();
    } catch (error: unknown) {
      showError('Could not update checklist item', getApiErrorMessage(error, 'Failed to update checklist item'));
    }
  }

  async function deleteChecklistItem(itemId: string) {
    if (!canMutateChildren || !window.confirm('Delete this checklist item?')) return;
    try {
      await adminApi.deleteTrackerChecklistItem(ticketId, itemId);
      await refreshTicket();
      showSuccess('Checklist item deleted', 'The item was removed from the ticket.');
    } catch (error: unknown) {
      showError('Could not delete checklist item', getApiErrorMessage(error, 'Failed to delete checklist item'));
    }
  }

  async function deleteComment(commentId: string) {
    if (!canMutateChildren || !window.confirm('Delete this comment?')) return;
    try {
      await adminApi.deleteTrackerComment(ticketId, commentId);
      await refreshTicket();
      showSuccess('Comment deleted', 'The comment was removed from the thread.');
    } catch (error: unknown) {
      showError('Could not delete comment', getApiErrorMessage(error, 'Failed to delete comment'));
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!canMutateChildren || !window.confirm('Delete this attachment?')) return;
    try {
      await adminApi.deleteTrackerAttachment(ticketId, attachmentId);
      await refreshTicket();
      showSuccess('Attachment deleted', 'The attachment reference was removed.');
    } catch (error: unknown) {
      showError('Could not delete attachment', getApiErrorMessage(error, 'Failed to delete attachment'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  const titleLabel = isNew ? 'Create tracker ticket' : ticket?.title || 'Tracker ticket';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/tracker" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to tracker board
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">{titleLabel}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Keep the implementation details in one place so product, engineering, and QA can work from the same record.
          </p>
        </div>

        <button
          type="button"
          onClick={saveTicket}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save ticket
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{isNew ? 'New ticket details' : 'Ticket details'}</h2>
            <p className="mt-1 text-sm text-slate-500">Capture the ticket type, ownership, due date, and release context.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Product area">
              <select value={draft.productArea} onChange={(e) => setDraft((prev) => ({ ...prev, productArea: e.target.value as TrackerProductArea }))} className="input-field">
                <option value="WEBAPP">Webapp</option>
                <option value="MOBILE_APP">Mobile app</option>
              </select>
            </Field>
            <Field label="Ticket type">
              <select value={draft.ticketType} onChange={(e) => setDraft((prev) => ({ ...prev, ticketType: e.target.value as TrackerTicketType }))} className="input-field">
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="CHORE">Chore</option>
                <option value="IMPROVEMENT">Improvement</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={draft.priority} onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as TrackerTicketPriority }))} className="input-field">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TrackerTicketStatus }))} className="input-field">
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="IN_TESTING">In testing</option>
                <option value="DONE">Done</option>
              </select>
            </Field>
            <Field label="Assignee">
              <select value={draft.assigneeId} onChange={(e) => setDraft((prev) => ({ ...prev, assigneeId: e.target.value }))} className="input-field">
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {personLabel(assignee)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="datetime-local" value={draft.dueDate} onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))} className="input-field" />
            </Field>
            <Field label="Release target">
              <input value={draft.releaseTarget} onChange={(e) => setDraft((prev) => ({ ...prev, releaseTarget: e.target.value }))} className="input-field" placeholder="v1.12.0 / Sprint 14" />
            </Field>
            <Field label="Sort order">
              <input type="number" min="0" value={draft.sortOrder} onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: e.target.value }))} className="input-field" />
            </Field>
          </div>

          <Field label="Title">
            <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} className="input-field" placeholder="Fix missing OTP display on login" />
          </Field>

          <Field label="Summary">
            <textarea value={draft.summary} onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))} rows={3} className="input-field" placeholder="One-paragraph summary of the ticket." />
          </Field>

          <Field label="Description">
            <textarea value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} rows={6} className="input-field" placeholder="Implementation notes, context, and scope." />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Acceptance criteria">
              <textarea value={draft.acceptanceCriteria} onChange={(e) => setDraft((prev) => ({ ...prev, acceptanceCriteria: e.target.value }))} rows={6} className="input-field" placeholder="What must be true before this is done?" />
            </Field>
            <Field label="Notes">
              <textarea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} rows={6} className="input-field" placeholder="Additional implementation notes or references." />
            </Field>
          </div>

          <Field label="Blocker reason">
            <textarea value={draft.blockerReason} onChange={(e) => setDraft((prev) => ({ ...prev, blockerReason: e.target.value }))} rows={3} className="input-field" placeholder="If blocked, note the dependency or reason here." />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="External links JSON">
              <textarea value={draft.externalLinksJson} onChange={(e) => setDraft((prev) => ({ ...prev, externalLinksJson: e.target.value }))} rows={5} className="input-field font-mono text-xs" placeholder='["https://figma.com/...","https://linear.app/..."]' />
            </Field>
            <Field label="Metadata JSON">
              <textarea value={draft.metadataJson} onChange={(e) => setDraft((prev) => ({ ...prev, metadataJson: e.target.value }))} rows={5} className="input-field font-mono text-xs" placeholder='{"releaseWindow":"2026-09-02","epic":"checkout"}' />
            </Field>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Comments" value={activityCounts.comments} icon={MessageSquare} />
            <StatCard label="Attachments" value={activityCounts.attachments} icon={Paperclip} />
            <StatCard label="Checklist" value={activityCounts.checklist} icon={ClipboardList} />
          </div>

          <Panel title="Checklist" subtitle="Track the steps that need to be completed before the ticket can move forward." icon={Check}>
            <div className="space-y-3">
              {canMutateChildren ? (
                <>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <input value={checklistDraft.label} onChange={(e) => setChecklistDraft((prev) => ({ ...prev, label: e.target.value }))} className="input-field" placeholder="Add checklist item" />
                    <input type="number" min="0" value={checklistDraft.sortOrder} onChange={(e) => setChecklistDraft((prev) => ({ ...prev, sortOrder: e.target.value }))} className="input-field md:w-28" />
                    <button type="button" onClick={addChecklistItem} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {ticket?.checklistItems.length ? ticket.checklistItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <button type="button" onClick={() => toggleChecklistItem(item)} className="flex items-center gap-3 text-left">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                            <Check className="h-3 w-3" />
                          </span>
                          <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-900'}>{item.label}</span>
                        </button>
                        <button type="button" onClick={() => deleteChecklistItem(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )) : (
                      <EmptyState text="No checklist items yet." />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState text="Save the ticket first to add checklist items." />
              )}
            </div>
          </Panel>

          <Panel title="Attachments" subtitle="Link screenshots, documents, specs, or design references." icon={Paperclip}>
            <div className="space-y-3">
              {canMutateChildren ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={attachmentDraft.label} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, label: e.target.value }))} className="input-field" placeholder="Attachment label" />
                    <input value={attachmentDraft.url} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, url: e.target.value }))} className="input-field" placeholder="https://..." />
                    <input value={attachmentDraft.mimeType} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, mimeType: e.target.value }))} className="input-field" placeholder="image/png" />
                    <input value={attachmentDraft.sizeBytes} onChange={(e) => setAttachmentDraft((prev) => ({ ...prev, sizeBytes: e.target.value }))} className="input-field" placeholder="Size in bytes" />
                  </div>
                  <button type="button" onClick={addAttachment} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                    <Plus className="h-4 w-4" />
                    Add attachment
                  </button>

                  <div className="space-y-2">
                    {ticket?.attachments.length ? ticket.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-950">{attachment.label}</p>
                            <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-sm text-orange-700 hover:underline">
                              <Link2 className="h-3.5 w-3.5" />
                              {attachment.url}
                            </a>
                            <p className="mt-1 text-xs text-slate-500">
                              {attachment.mimeType || 'Unknown type'}
                              {attachment.sizeBytes ? ` - ${attachment.sizeBytes} bytes` : ''}
                              {attachment.uploadedByName ? ` - by ${attachment.uploadedByName}` : ''}
                            </p>
                          </div>
                          <button type="button" onClick={() => deleteAttachment(attachment.id)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )) : (
                      <EmptyState text="No attachments yet." />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState text="Save the ticket first to add attachments." />
              )}
            </div>
          </Panel>

          <Panel title="Comments" subtitle="Keep decisions, handoffs, and QA updates attached to the ticket." icon={MessageSquare}>
            <div className="space-y-3">
              {canMutateChildren ? (
                <>
                  <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={4} className="input-field" placeholder="Add a new update or request..." />
                  <div className="flex justify-end">
                    <button type="button" onClick={addComment} className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                      <Plus className="h-4 w-4" />
                      Add comment
                    </button>
                  </div>

                  <div className="space-y-3">
                    {ticket?.comments.length ? ticket.comments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{comment.authorName || 'System'}</p>
                            <p className="mt-1 text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</p>
                          </div>
                          <button type="button" onClick={() => deleteComment(comment.id)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
                      </div>
                    )) : (
                      <EmptyState text="No comments yet." />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState text="Save the ticket first to start the ticket conversation." />
              )}
            </div>
          </Panel>

          <Panel title="Additional info" subtitle="Use this section for release notes, blockers, and linked docs." icon={AlertTriangle}>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoPill label="Created by" value={ticket?.createdBy ? personLabel(ticket.createdBy) : 'Unknown'} />
              <InfoPill label="Updated by" value={ticket?.updatedBy ? personLabel(ticket.updatedBy) : 'Unknown'} />
              <InfoPill label="Created at" value={ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : '-'} />
              <InfoPill label="Updated at" value={ticket?.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '-'} />
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function parseJsonField(value: string, label: string) {
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as TrackerTicketWriteInput['externalLinksJson'];
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
