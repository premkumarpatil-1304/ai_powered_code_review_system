"use client";
import { FormEvent, useState } from "react";
import { ArrowLeft, FolderPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  Project,
  api,
} from "@/lib/api/client";
import { RequireAuth } from "@/components/require-auth";

function NewProjectInner() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const created = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={14} /> Back to overview
        </Link>
        <div className="mb-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
            <FolderPlus size={21} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            Create a project
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Start a workspace for a repository or service you want to review.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-600">
              Project name
            </span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atlas API"
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-600">
              Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this project do?"
              className="field min-h-24 resize-none"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-semibold text-white hover:bg-cyan-950 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              "Create project"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewProject() {
  return (
    <RequireAuth>
      <NewProjectInner />
    </RequireAuth>
  );
}
