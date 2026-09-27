"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Upload,
  X,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { AppShell, SectionLabel, Severity } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import {
  ApiError,
  FileNode,
  FilePreview,
  Project as ProjectType,
  Provider,
  Review,
  ReviewIssue,
  ReviewTemplate,
  UploadResult,
  api,
} from "@/lib/api/client";

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

function SparkleIcon() {
  return <span className="text-sm">✦</span>;
}

function Tree({
  node,
  level,
  open,
  toggle,
  selected,
  setSelected,
}: {
  node: FileNode;
  level: number;
  open: Record<string, boolean>;
  toggle: (id: string) => void;
  selected: string | null;
  setSelected: (n: FileNode) => void;
}) {
  const isOpen = open[node.id];
  const isSelected = selected === node.id;

  return (
    <div>
      <button
        onClick={() => (node.is_directory ? toggle(node.id) : setSelected(node))}
        className={`flex w-full items-center gap-1 rounded-lg py-1.5 pr-2 text-left text-xs transition hover:bg-slate-100 ${
          isSelected && !node.is_directory
            ? "bg-cyan-50 font-semibold text-cyan-800"
            : "text-slate-600"
        }`}
        style={{ paddingLeft: 8 + level * 15 }}
      >
        {node.is_directory ? (
          isOpen ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )
        ) : (
          <span className="w-[13px]" />
        )}
        {node.is_directory ? (
          isOpen ? (
            <FolderOpen size={15} className="text-cyan-600" />
          ) : (
            <Folder size={15} className="text-amber-500" />
          )
        ) : (
          <FileCode2 size={14} className="text-slate-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.is_directory &&
        isOpen &&
        node.children?.map((c: FileNode) => (
          <Tree
            key={c.id}
            node={c}
            level={level + 1}
            open={open}
            toggle={toggle}
            selected={selected}
            setSelected={setSelected}
          />
        ))}
    </div>
  );
}

function Issue({
  title,
  severity,
  file,
  lines,
  desc,
  recommendation,
}: {
  title: string;
  severity: string;
  file: string;
  lines?: string | null;
  desc: string;
  recommendation?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800">{title}</div>
        <Severity value={severity} />
      </div>
      {(file || lines) && (
        <div className="mt-2 font-mono text-[10px] text-slate-400">
          {file}
          {lines ? ` · lines ${lines}` : ""}
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500">{desc}</p>
      {recommendation && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800">
          Recommendation: {recommendation}
        </div>
      )}
    </div>
  );
}

function ProjectInner() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<ProjectType | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<FilePreview | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [scope, setScope] = useState<"file" | "files" | "project">("project");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [lastReview, setLastReview] = useState<Review | null>(null);
  const [pageError, setPageError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFileCount = useMemo(() => {
    function walk(nodes: FileNode[]): number {
      let n = 0;
      for (const node of nodes) {
        if (node.is_directory) n += walk(node.children || []);
        else n += 1;
      }
      return n;
    }
    return walk(fileTree);
  }, [fileTree]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingProject(true);
      setPageError("");
      try {
        const p = await api<ProjectType>(`/api/projects/${projectId}`);
        if (cancelled) return;
        setProject(p);
      } catch (err) {
        if (!cancelled)
          setPageError(err instanceof ApiError ? err.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadFiles() {
      setLoadingFiles(true);
      try {
        const tree = await api<FileNode[]>(`/api/projects/${projectId}/files`);
        if (cancelled) return;
        setFileTree(tree);
        const defaultOpen: Record<string, boolean> = {};
        function openTopDirs(nodes: FileNode[], depth: number) {
          if (depth > 1) return;
          for (const n of nodes) {
            if (n.is_directory) {
              defaultOpen[n.id] = true;
              openTopDirs(n.children || [], depth + 1);
            }
          }
        }
        openTopDirs(tree, 0);
        setOpenFolders(defaultOpen);
      } catch {
        // might be 404 if no files uploaded yet - that's fine
        if (!cancelled) setFileTree([]);
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const [ps, ts] = await Promise.all([
          api<Provider[]>("/api/providers").catch(() => [] as Provider[]),
          api<ReviewTemplate[]>("/api/review-templates").catch(
            () => [] as ReviewTemplate[],
          ),
        ]);
        if (cancelled) return;
        setProviders(ps);
        setTemplates(ts);
        if (ps.length) {
          const def = ps.find((x) => x.is_default) || ps[0];
          if (def) setSelectedProviderId(def.id);
        }
        if (ts.length) {
          setSelectedTemplateSlug(ts[0].slug);
        }
      } catch {
        /* ignore */
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api<UploadResult>(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: form,
      });
      const tree = await api<FileNode[]>(`/api/projects/${projectId}/files`);
      setFileTree(tree);
      const defaultOpen: Record<string, boolean> = {};
      function openTopDirs(nodes: FileNode[], depth: number) {
        if (depth > 1) return;
        for (const n of nodes) {
          if (n.is_directory) {
            defaultOpen[n.id] = true;
            openTopDirs(n.children || [], depth + 1);
          }
        }
      }
      openTopDirs(tree, 0);
      setOpenFolders(defaultOpen);
      setSelectedNode(null);
      setSelectedFilePreview(null);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSelectFile(node: FileNode) {
    if (node.is_directory) return;
    setSelectedNode(node);
    setLoadingPreview(node.id);
    try {
      const preview = await api<FilePreview>(`/api/files/${node.id}`);
      setSelectedFilePreview(preview);
    } catch {
      setSelectedFilePreview({
        id: node.id,
        name: node.name,
        path: node.path,
        language: node.language ?? null,
        size: node.size ?? null,
        content: null,
        is_binary: true,
        truncated: false,
      });
    } finally {
      setLoadingPreview(null);
    }
  }

  function toggleFolder(id: string) {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleFileSelected(fileId: string) {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((x) => x !== fileId) : [...prev, fileId],
    );
  }

  function ensureScopeSelection() {
    if (scope === "project") return [];
    if (scope === "file") {
      if (!selectedFileIds.length && selectedNode && !selectedNode.is_directory) {
        setSelectedFileIds([selectedNode.id]);
        return [selectedNode.id];
      }
    }
    return selectedFileIds;
  }

  async function runReview() {
    setRunning(true);
    setReviewError("");
    setLastReview(null);
    try {
      const ids = ensureScopeSelection();
      if ((scope === "file" || scope === "files") && !ids.length) {
        throw new Error("Select at least one file before running review.");
      }
      if (!selectedTemplateSlug) throw new Error("No review template selected.");
      if (!selectedProviderId) throw new Error("No AI provider selected.");

      const review = await api<Review>(`/api/projects/${projectId}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          template_slug: selectedTemplateSlug,
          provider_id: selectedProviderId,
          scope,
          file_ids: scope === "project" ? [] : ids,
        }),
      });
      setLastReview(review);
    } catch (err) {
      setReviewError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to run review",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loadingProject && !project) {
    return (
      <AppShell title="Loading project…" eyebrow="Project workspace">
        <div className="mx-auto flex max-w-[1320px] items-center justify-center py-24">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 size={18} className="animate-spin text-cyan-600" />
            <span className="font-medium text-slate-600">Loading workspace…</span>
          </div>
        </div>
      </AppShell>
    );
  }

  const fileCountDisplay = totalFileCount > 0 ? `${totalFileCount} files` : "No files yet";

  return (
    <AppShell title={project?.name ?? "Project"} eyebrow="Project workspace">
      <div className="mx-auto max-w-[1450px] space-y-5">
        {pageError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {pageError}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <GitBranch size={14} /> main{" "}
              <span>·</span> {project ? `synced ${timeAgo(project.created_at)}` : ""}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {project?.description || "No description"} · {fileCountDisplay}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <MessageSquare size={15} /> Ask about this project
            </button>
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white ${
                uploading ? "bg-slate-400" : "bg-slate-950 hover:bg-cyan-950"
              }`}
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploading ? "Uploading…" : "Upload ZIP"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={onUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
        {uploadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{uploadError}</span>
            <button
              onClick={() => setUploadError("")}
              className="text-red-500 hover:text-red-700"
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="grid min-h-[670px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[230px_minmax(400px,1fr)_360px]">
          <aside className="border-b border-slate-200 bg-[#fbfcfd] xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <SectionLabel>Files</SectionLabel>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                {totalFileCount}
              </span>
            </div>
            <div className="p-3 text-sm max-h-[670px] overflow-auto">
              {loadingFiles ? (
                <div className="flex items-center gap-2 px-2 py-4 text-xs text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> Loading files…
                </div>
              ) : fileTree.length === 0 ? (
                <div className="px-2 py-10 text-center text-xs text-slate-400">
                  Upload a ZIP to get started.
                </div>
              ) : (
                fileTree.map((f) => (
                  <Tree
                    key={f.id}
                    node={f}
                    level={0}
                    open={openFolders}
                    toggle={toggleFolder}
                    selected={selectedNode?.id ?? null}
                    setSelected={onSelectFile}
                  />
                ))
              )}
            </div>
          </aside>
          <section className="min-w-0 border-b border-slate-200 bg-[#182333] xl:border-b-0 xl:border-r">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-5">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <FileCode2 size={15} className="text-cyan-300" />
                {loadingPreview ? (
                  <span className="text-slate-400 text-xs">Loading…</span>
                ) : (
                  <>
                    <span className="truncate">
                      {selectedFilePreview?.name ||
                        selectedNode?.name ||
                        "No file selected"}
                    </span>
                    {selectedFilePreview?.language && (
                      <span className="text-[10px] text-slate-500 ml-2">
                        {selectedFilePreview.language}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {selectedFilePreview?.content
                  ? `${selectedFilePreview.content.split("\n").length} lines`
                  : ""}
                {selectedFilePreview?.truncated ? " · truncated" : ""}
              </span>
            </div>
            <div className="h-[618px] overflow-auto text-[12px] leading-6">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 size={16} className="animate-spin" /> Loading file…
                  </div>
                </div>
              ) : selectedFilePreview?.is_binary ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400 px-6">
                    <FileCode2 size={28} className="mx-auto mb-3 opacity-60" />
                    <p className="text-sm">Binary file — preview not supported.</p>
                  </div>
                </div>
              ) : selectedFilePreview?.content ? (
                <SyntaxHighlighter
                  language={
                    selectedFilePreview.language?.toLowerCase() ||
                    (selectedFilePreview.name.endsWith(".ts") ||
                    selectedFilePreview.name.endsWith(".tsx")
                      ? "typescript"
                      : selectedFilePreview.name.endsWith(".js") ||
                          selectedFilePreview.name.endsWith(".jsx")
                        ? "javascript"
                        : selectedFilePreview.name.endsWith(".py")
                          ? "python"
                          : "text")
                  }
                  style={atomOneDark}
                  customStyle={{
                    margin: 0,
                    padding: "24px 20px",
                    background: "transparent",
                    fontSize: 12,
                    lineHeight: 1.8,
                  }}
                  showLineNumbers
                >
                  {selectedFilePreview.content}
                </SyntaxHighlighter>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400 px-6">
                    <FileCode2 size={28} className="mx-auto mb-3 opacity-60" />
                    <p className="text-sm">Select a file from the tree to preview its contents.</p>
                  </div>
                </div>
              )}
            </div>
          </section>
          <aside className="bg-white max-h-[670px] overflow-auto">
            <div className="border-b border-slate-100 px-5 py-4 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                  <SparkleIcon />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Run AI review</div>
                  <div className="text-[11px] text-slate-400">Find issues before they ship</div>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Review template
                </span>
                <select
                  className="field"
                  value={selectedTemplateSlug}
                  onChange={(e) => setSelectedTemplateSlug(e.target.value)}
                >
                  {templates.length === 0 ? (
                    <option value="">Loading templates…</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AI provider
                </span>
                <select
                  className="field"
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                >
                  {providers.length === 0 ? (
                    <option value="">No providers configured</option>
                  ) : (
                    providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.model_name}
                        {p.is_default ? " (default)" : ""}
                        {!p.has_api_key ? " ⚠ missing key" : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Review scope
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                  {(["file", "files", "project"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={`rounded-lg py-2 text-[11px] font-semibold capitalize ${
                        scope === s
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {scope !== "project" && (
                <div className="rounded-xl border border-slate-200 p-3 max-h-56 overflow-auto">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selected files
                  </div>
                  {fileTree.length === 0 ? (
                    <p className="text-xs text-slate-400">Upload files first.</p>
                  ) : (
                    (function walkFlat(nodes: FileNode[]): React.ReactNode[] {
                      const out: React.ReactNode[] = [];
                      function w(ns: FileNode[]) {
                        for (const n of ns) {
                          if (n.is_directory) w(n.children || []);
                          else {
                            const isCurrent = selectedNode?.id === n.id;
                            const label =
                              scope === "file" ? "Auto (current file)" : n.path;
                            out.push(
                              <label
                                key={n.id}
                                className={`flex items-start gap-2 text-xs py-1 ${
                                  scope === "file" && !isCurrent
                                    ? "text-slate-300 pointer-events-none opacity-50"
                                    : "text-slate-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="accent-cyan-600 mt-0.5"
                                  checked={
                                    scope === "file"
                                      ? isCurrent || selectedFileIds.includes(n.id)
                                      : selectedFileIds.includes(n.id)
                                  }
                                  onChange={() =>
                                    scope === "file"
                                      ? setSelectedFileIds([n.id])
                                      : toggleFileSelected(n.id)
                                  }
                                />
                                <span className="font-mono truncate">
                                  {scope === "file" ? n.name : label}
                                </span>
                              </label>,
                            );
                          }
                        }
                      }
                      w(nodes);
                      return out;
                    })(fileTree)
                  )}
                </div>
              )}
              <button
                onClick={runReview}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-70"
              >
                {running ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Reviewing code…
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" /> Run review
                  </>
                )}
              </button>
              {reviewError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
                  {reviewError}
                </div>
              )}
              {lastReview && (
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  {lastReview.status === "failed" && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
                      Review failed: {lastReview.error_message || "Unknown error"}
                    </div>
                  )}
                  {lastReview.status === "completed" && (
                    <>
                      <div>
                        <SectionLabel>Review summary</SectionLabel>
                        <p className="text-sm leading-6 text-slate-600">
                          {lastReview.summary || "No summary provided."}
                        </p>
                        {lastReview.recommendations &&
                          lastReview.recommendations.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              <SectionLabel>Recommendations</SectionLabel>
                              {lastReview.recommendations.map((r, i) => (
                                <li
                                  key={i}
                                  className="text-xs leading-5 text-slate-600 flex gap-2"
                                >
                                  <span className="text-cyan-600">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                      {lastReview.issues && lastReview.issues.length > 0 ? (
                        <div className="space-y-3">
                          <SectionLabel>
                            {lastReview.issues.length} finding
                            {lastReview.issues.length === 1 ? "" : "s"}
                          </SectionLabel>
                          {lastReview.issues.map((iss: ReviewIssue, i) => (
                            <Issue
                              key={i}
                              title={iss.title}
                              severity={iss.severity}
                              file={iss.file_path}
                              lines={
                                iss.line_start
                                  ? iss.line_end
                                    ? `${iss.line_start}–${iss.line_end}`
                                    : String(iss.line_start)
                                  : null
                              }
                              desc={iss.description}
                              recommendation={iss.recommendation}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          No issues found.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

export default function Project() {
  return (
    <RequireAuth>
      <ProjectInner />
    </RequireAuth>
  );
}
