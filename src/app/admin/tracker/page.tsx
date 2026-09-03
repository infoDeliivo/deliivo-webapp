'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Loader2, Plus, RefreshCcw, Sparkles } from 'lucide-react';
import { adminApi, getApiErrorMessage, TrackerProductArea, TrackerTicket, TrackerTicketPriority, TrackerTicketStatus } from '@/lib/api';
import { showError } from '@/lib/app-feedback';

const columns: Array<{ status: TrackerTicketStatus; label: string; description: string }> = [
  { status: 'TODO', label: 'To do', description: 'Queued work and ready tasks.' },
  { status: 'IN_PROGRESS', label: 'In progress', description: 'Work actively being implemented.' },
  { status: 'IN_TESTING', label: 'In testing', description: 'Ready for QA and release validation.' },
  { status: 'DONE', label: 'Done', description: 'Shipped or fully completed.' },
];

const productAreaLabels: Record<TrackerProductArea, string> = {
  WEBAPP: 'Webapp',
  MOBILE_APP: 'Mobile app',
};

const priorityTone: Record<TrackerTicketPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-700',
};

const statusTone: Record<TrackerTicketStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  IN_TESTING: 'bg-violet-100 text-violet-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

export default function AdminTrackerBoardPage() {
  const [activeArea, setActiveArea] = useState<TrackerProductArea>('WEBAPP');
  const [tickets, setTickets] = useState<TrackerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTickets(area: TrackerProductArea, withSpinner = true) {
    if (withSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await adminApi.getTrackerTickets({ productArea: area });
      setTickets(response.data || []);
    } catch (error: unknown) {
      showError('Could not load tracker tickets', getApiErrorMessage(error, 'Failed to fetch tracker tickets'));
    } finally {
      if (withSpinner) setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTickets(activeArea);
  }, [activeArea]);

  const summary = useMemo(() => {
    const total = tickets.length;
    const todo = tickets.filter((ticket) => ticket.status === 'TODO').length;
    const progress = tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
    const testing = tickets.filter((ticket) => ticket.status === 'IN_TESTING').length;
    const done = tickets.filter((ticket) => ticket.status === 'DONE').length;
    const urgent = tickets.filter((ticket) => ticket.priority === 'URGENT').length;
    const overdue = tickets.filter((ticket) => ticket.dueDate && new Date(ticket.dueDate).getTime() < Date.now() && ticket.status !== 'DONE').length;

    return { total, todo, progress, testing, done, urgent, overdue };
  }, [tickets]);

  const boardColumns = useMemo(() => columns.map((column) => ({
    ...column,
    tickets: tickets.filter((ticket) => ticket.status === column.status),
  })), [tickets]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">Delivery tracker</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Track bugs, stories, and release work across web and mobile</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Use this board to manage active work for the Deliivo webapp and mobile app. Each ticket carries status, priority, assignee, due date, checklist progress, comments, and attachments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => loadTickets(activeArea, false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
            <Link
              href={`/admin/tracker/new?area=${activeArea}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(productAreaLabels) as TrackerProductArea[]).map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setActiveArea(area)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeArea === area ? 'bg-white text-slate-950 shadow-sm' : 'bg-white/10 text-white/75 hover:bg-white/15 hover:text-white'
              }`}
            >
              {productAreaLabels[area]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total tickets" value={summary.total} icon={ClipboardList} />
        <MetricCard label="To do" value={summary.todo} icon={Sparkles} />
        <MetricCard label="In progress" value={summary.progress} icon={RefreshCcw} />
        <MetricCard label="In testing" value={summary.testing} icon={AlertCircle} />
        <MetricCard label="Done" value={summary.done} icon={CheckCircle2} />
        <MetricCard label="Urgent / overdue" value={summary.urgent + summary.overdue} icon={CalendarDays} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-4">
          {boardColumns.map((column) => (
            <section key={column.status} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{column.label}</h2>
                    <p className="mt-1 text-xs text-slate-500">{column.description}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[column.status]}`}>
                    {column.tickets.length}
                  </span>
                </div>
              </div>

              <div className="max-h-[72vh] space-y-3 overflow-y-auto p-4">
                {column.tickets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No tickets in this column.
                  </div>
                ) : (
                  column.tickets.map((ticket) => <TrackerCard key={ticket.id} ticket={ticket} />)
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
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

function TrackerCard({ ticket }: { ticket: TrackerTicket }) {
  const dueLabel = ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : 'No due date';
  const checklistLabel = ticket.checklistTotalCount > 0
    ? `${ticket.checklistDoneCount}/${ticket.checklistTotalCount} checklist`
    : 'No checklist';

  return (
    <Link
      href={`/admin/tracker/${ticket.id}`}
      className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50/70 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              {ticket.ticketType}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityTone[ticket.priority]}`}>
              {ticket.priority}
            </span>
          </div>
          <h3 className="mt-3 truncate text-sm font-semibold text-slate-950">{ticket.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{ticket.summary || ticket.description || 'No summary provided.'}</p>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span>Assignee</span>
          <span className="font-medium text-slate-800">{ticket.assigneeName || 'Unassigned'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Due date</span>
          <span className="font-medium text-slate-800">{dueLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Progress</span>
          <span className="font-medium text-slate-800">{checklistLabel}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {ticket.commentsCount} comments
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {ticket.attachmentsCount} attachments
        </span>
        {ticket.blockerReason ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
            Blocked
          </span>
        ) : null}
      </div>
    </Link>
  );
}
