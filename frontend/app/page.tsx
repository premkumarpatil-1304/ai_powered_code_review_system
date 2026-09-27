"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FolderGit2,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, SectionLabel, Severity } from "@/components/app-shell";
import {
  ApiError,
  Project,
  Review,
  ReviewIssue,
  api,
} from "@/lib/api/client";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/contexts/AuthContext";

const PROJECT_COLORS = [
  "bg-cyan-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-sky-400",
];

function colorForId(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return PROJECT_COLORS[sum % PROJECT_COLORS.length];
}

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

type ActivityRow = Review & { projectName: string; issue?: ReviewIssue };

function DashboardInner() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [reviewsByProject, setReviewsByProject] = useState<
    Record<string, Review[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const list = await api<Project[]>("/api/projects");
        if (cancelled) return;
        setProjects(list);
        const byId: Record<string, Review[]> = {};
        await Promise.all(
          list.map(async (p) => {
            try {
              const rs = await api<Review[]>(`/api/projects/${p.id}/reviews`);
              if (!cancelled) byId[p.id] = rs;
            } catch {
              if (!cancelled) byId[p.id] = [];
            }
          }),
        );
        if (cancelled) return;
        setReviewsByProject(byId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectMap = useMemo(() => {
    const m: Record<string, Project> = {};
    projects?.forEach((p) => (m[p.id] = p));
    return m;
  }, [projects]);

  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];
    if (!projects) return rows;
    for (const p of projects) {
      for (const r of reviewsByProject[p.id] || []) {
        const issue = (r.issues || [])[0];
        rows.push({ ...r, projectName: p.name, issue });
      }
    }
    return rows.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [projects, reviewsByProject]);

  const metrics = useMemo(() => {
    const all = Object.values(reviewsByProject).flat();
    let issues = 0;
    let critical = 0;
    for (const r of all) {
      for (const i of r.issues || []) {
        issues++;
        if (i.severity === "critical") critical++;
      }
    }
    return {
      reviews: all.length,
      issues,
      critical,
    };
  }, [reviewsByProject]);

  async function deleteProject(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      setReviewsByProject((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const greeting = useMemo(() => {
    const name =
      user?.email.split("@")[0]?.replace(/[^a-zA-Z]/g, " ") || "there";
    const cap = name
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const hour = new Date().getHours();
    const when =
      hour < 5
        ? "Good night"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
    return `${when}, ${cap || "there"}`;
  }, [user]);

  if (loading) {
    return (
      <AppShell title={greeting} eyebrow="Overview">
        <div className="mx-auto flex max-w-[1320px] items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 size={18} className="animate-spin text-cyan-600" />
            <span className="font-medium text-slate-600">
              Loading workspace…
            </span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={greeting} eyebrow="Overview">
      <div className="mx-auto max-w-[1320px] space-y-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Your code, reviewed with context.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Run focused AI reviews across your repositories and turn findings
              into fixes your team can ship.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-cyan-950"
          >
            <Plus size={17} /> New project
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            label="Reviews this month"
            value={String(metrics.reviews)}
            delta={metrics.reviews > 0 ? "Live data" : "No reviews yet"}
            icon={<Sparkles size={17} />}
            tone="cyan"
          />
          <Metric
            label="Issues resolved"
            value={String(metrics.issues)}
            delta={metrics.issues > 0 ? "Total found" : "Keep going"}
            icon={<CheckCircle2 size={17} />}
            tone="emerald"
          />
          <Metric
            label="Critical findings"
            value={String(metrics.critical)}
            delta={metrics.critical > 0 ? "Needs attention" : "Clean"}
            icon={<ShieldAlert size={17} />}
            tone={metrics.critical > 0 ? "rose" : "emerald"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Active projects · {projects?.length || 0}</SectionLabel>
              <Link
                href="/history"
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
              >
                View history{" "}
                <ArrowUpRight className="ml-1 inline" size={13} />
              </Link>
            </div>

            {!projects || projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                desc="Create a project and upload your first ZIP to get started."
                action={
                  <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-950"
                  >
                    <Plus size={16} /> New project
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((project) => {
                  const reviews = reviewsByProject[project.id] || [];
                  const confirmed = confirmDeleteId === project.id;
                  const deleting = deletingId === project.id;
                  return (
                    <div
                      key={project.id}
                      className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-xl ${colorForId(project.id)} text-slate-950`}
                        >
                          <FolderGit2 size={19} />
                        </div>
                        <div className="flex items-center gap-1">
                          {confirmed ? (
                            <button
                              onClick={() => deleteProject(project.id)}
                              disabled={deleting}
                              className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100 hover:bg-red-100 disabled:opacity-50"
                              title="Confirm delete"
                            >
                              {deleting ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={15} />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(project.id)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"
                              title="Delete project"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <Link
                            href={`/projects/${project.id}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-600"
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </div>
                      </div>
                      <Link href={`/projects/${project.id}`} className="block">
                        <h3 className="mt-5 font-semibold text-slate-900">
                          {project.name}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {project.description || "No description"}
                        </p>
                        <div className="mt-6 flex gap-5 border-t border-slate-100 pt-4 text-xs">
                          <span>
                            <b className="text-slate-800">{reviews.length}</b>{" "}
                            <span className="text-slate-400">reviews</span>
                          </span>
                          <span className="ml-auto flex items-center gap-1 text-emerald-600">
                            <CircleDot size={10} /> {timeAgo(project.created_at)}
                          </span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <SectionLabel>Latest findings</SectionLabel>
              <Link
                href="/history"
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
              >
                History
              </Link>
            </div>
            {activity.length === 0 ? (
              <EmptyState
                small
                title="No activity yet"
                desc="Once you run a review, findings will show up here."
              />
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-auto pr-1">
                {activity.slice(0, 20).map((r, idx) => (
                  <div
                    key={r.id + "-" + idx}
                    className="flex gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50"
                  >
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="truncate text-sm font-medium text-slate-800">
                            {r.issue?.title ||
                              (r.status === "failed"
                                ? "Review failed"
                                : "Review completed")}
                          </div>
                          <div className="mt-1 truncate font-mono text-[11px] text-slate-400">
                            {r.issue?.file_path ||
                              projectMap[r.project_id]?.name ||
                              r.projectName}
                          </div>
                        </div>
                        <Severity
                          value={
                            r.issue?.severity ||
                            (r.status === "failed" ? "high" : "low")
                          }
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">
                        {r.projectName} · {timeAgo(r.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="rounded-2xl bg-[#16243a] p-6 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
                <Sparkles size={14} /> Review pilot
              </div>
              <div className="text-lg font-semibold">
                Bring your own model. Keep your code private.
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Connect OpenAI, Ollama, LM Studio, or any OpenAI-compatible
                endpoint.
              </p>
            </div>
            <Link
              href="/providers"
              className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-50"
            >
              Configure providers <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  delta,
  icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  tone: "cyan" | "emerald" | "rose";
}) {
  const bg =
    tone === "cyan"
      ? "bg-cyan-50 text-cyan-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-rose-50 text-rose-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${bg}`}>
          {icon}
        </div>
        <span
          className={`text-[11px] font-semibold ${
            tone === "rose" ? "text-rose-600" : "text-emerald-600"
          }`}
        >
          {delta}
        </span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function EmptyState({
  title,
  desc,
  action,
  small,
}: {
  title: string;
  desc: string;
  action?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center ${
        small ? "py-10 px-5" : "py-16 px-6"
      }`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <FolderGit2 size={22} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
