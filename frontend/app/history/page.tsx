"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  SlidersHorizontal,
  XCircle,
  X,
  Loader2,
} from "lucide-react";
import { AppShell, SectionLabel, Severity } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import {
  ApiError,
  Project,
  Review,
  ReviewIssue,
  ReviewTemplate,
  api,
} from "@/lib/api/client";

type HistoryRow = Review & { projectName: string; templateName?: string; topSev?: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const dt = new Date(iso);
  return dt.toLocaleDateString();
}

function IssueCard({ iss }: { iss: ReviewIssue }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800">{iss.title}</div>
        <Severity value={iss.severity} />
      </div>
      {(iss.file_path || iss.line_start) && (
        <div className="mt-2 font-mono text-[10px] text-slate-400">
          {iss.file_path}
          {iss.line_start
            ? iss.line_end
              ? ` · lines ${iss.line_start}–${iss.line_end}`
              : ` · line ${iss.line_start}`
            : ""}
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500">{iss.description}</p>
      {iss.recommendation && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800">
          Recommendation: {iss.recommendation}
        </div>
      )}
    </div>
  );
}

function HistoryInner() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [ps, ts] = await Promise.all([
          api<Project[]>("/api/projects"),
          api<ReviewTemplate[]>("/api/review-templates").catch(
            () => [] as ReviewTemplate[],
          ),
        ]);
        if (cancelled) return;
        const templateById: Record<string, ReviewTemplate> = {};
        for (const t of ts) templateById[t.id] = t;

        const reviewsByProject = await Promise.all(
          ps.map(async (p) => {
            try {
              return await api<Review[]>(`/api/projects/${p.id}/reviews`);
            } catch {
              return [] as Review[];
            }
          }),
        );
        if (cancelled) return;
        const all: HistoryRow[] = [];
        reviewsByProject.forEach((list, i) => {
          const p = ps[i];
          for (const r of list) {
            const tmpl = templateById[r.template_id];
            const issues = r.issues || [];
            const sevOrder = ["critical", "high", "medium", "low"];
            let topSev: string | undefined;
            for (const iss of issues) {
              const idx = sevOrder.indexOf(iss.severity);
              const curIdx = topSev === undefined ? 99 : sevOrder.indexOf(topSev);
              if (idx >= 0 && idx < curIdx) {
                topSev = iss.severity;
              }
            }
            all.push({
              ...r,
              projectName: p?.name ?? "Unknown project",
              templateName: tmpl?.name,
              topSev,
            });
          }
        });
        all.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setRows(all);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.templateName !== templateFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${r.projectName} ${r.templateName ?? ""} ${r.scope} ${
          r.summary ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, templateFilter]);

  const templateNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) if (r.templateName) names.add(r.templateName);
    return Array.from(names);
  }, [rows]);

  async function openReview(r: HistoryRow) {
    setSelectedReviewId(r.id);
    setSelectedReview(null);
    setDetailError("");
    setLoadingDetail(true);
    try {
      const detail = await api<Review>(`/api/reviews/${r.id}`);
      setSelectedReview(detail);
      setSelectedProjectName(r.projectName);
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : "Failed to load review details",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeReview() {
    setSelectedReviewId(null);
    setSelectedReview(null);
    setDetailError("");
  }

  return (
    <AppShell title="Review history" eyebrow="Activity">
      <div className="mx-auto max-w-[1180px] space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Every review, in one place.
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Search across projects, templates, and review scopes.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-3 text-slate-400 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviews…"
              className="field pl-10"
            />
          </div>
          <select
            className="field md:w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="field md:w-44"
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
          >
            <option value="all">All templates</option>
            {templateNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Filters"
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}
        <section>
          <SectionLabel>
            {loading ? "Loading…" : `${filtered.length} review${filtered.length === 1 ? "" : "s"} found`}
          </SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center p-16">
                <div className="flex items-center gap-3 text-slate-500">
                  <Loader2 size={18} className="animate-spin text-cyan-600" />
                  <span className="font-medium text-sm">Loading history…</span>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                  <Clock3 size={22} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800">
                  No reviews yet
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Once you run an AI review on a project, every finding will appear
                  here.
                </p>
              </div>
            ) : (
              filtered.map((r, i) => {
                const isOpen = selectedReviewId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`${
                      i < filtered.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <button
                      onClick={() => openReview(r)}
                      className={`flex w-full flex-col gap-4 p-5 text-left transition hover:bg-slate-50 md:flex-row md:items-center ${
                        isOpen ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100">
                        {r.status === "completed" ? (
                          <CheckCircle2 className="text-emerald-500" size={20} />
                        ) : (
                          <XCircle className="text-red-400" size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {r.projectName}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="text-sm text-slate-500">
                            {r.templateName || "Review"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {r.scope} · {r.summary || r.error_message || "No summary"}
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2 text-xs font-semibold capitalize text-slate-600">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                r.status === "completed" ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            {r.status}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {timeAgo(r.created_at)}
                          </div>
                        </div>
                        <Severity
                          value={
                            r.topSev ||
                            (r.status === "failed" ? "high" : "low")
                          }
                        />
                        <ChevronRight
                          size={17}
                          className={`text-slate-300 transition ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-5 pl-[72px] md:pl-[88px]">
                        {loadingDetail ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                            <Loader2 size={15} className="animate-spin text-cyan-600" />
                            Loading details…
                          </div>
                        ) : detailError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
                            <span>{detailError}</span>
                            <button
                              onClick={closeReview}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : selectedReview ? (
                          <div className="space-y-5">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">
                                  {selectedProjectName}
                                </span>
                                <span>·</span>
                                <span>Review ID: {r.id.slice(0, 8)}…</span>
                                <span>·</span>
                                <span>Scope: {r.scope}</span>
                              </div>
                              <button
                                onClick={closeReview}
                                className="text-slate-400 hover:text-slate-700"
                                title="Close"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            {selectedReview.status === "failed" ? (
                              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                Review failed:{" "}
                                {selectedReview.error_message || "Unknown error"}
                              </div>
                            ) : (
                              <>
                                <div>
                                  <SectionLabel>Summary</SectionLabel>
                                  <p className="text-sm leading-6 text-slate-600">
                                    {selectedReview.summary || "No summary provided."}
                                  </p>
                                </div>
                                {selectedReview.recommendations &&
                                  selectedReview.recommendations.length > 0 && (
                                    <div>
                                      <SectionLabel>Recommendations</SectionLabel>
                                      <ul className="space-y-1.5">
                                        {selectedReview.recommendations.map(
                                          (rec, i) => (
                                            <li
                                              key={i}
                                              className="text-xs leading-5 text-slate-600 flex gap-2"
                                            >
                                              <span className="text-cyan-600">•</span>
                                              <span>{rec}</span>
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                {selectedReview.issues &&
                                selectedReview.issues.length > 0 ? (
                                  <div className="space-y-3">
                                    <SectionLabel>
                                      {selectedReview.issues.length} finding
                                      {selectedReview.issues.length === 1 ? "" : "s"}
                                    </SectionLabel>
                                    {selectedReview.issues.map((iss, i) => (
                                      <IssueCard key={i} iss={iss as ReviewIssue} />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500">
                                    No issues found in this review.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function History() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}
