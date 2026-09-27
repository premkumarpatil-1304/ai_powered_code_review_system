"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Code2, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RedirectIfAuthenticated } from "@/components/require-auth";
import { ApiError } from "@/lib/api/client";

function RegisterInner() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(email, password);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fb] p-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-slate-950">
            <Code2 size={20} />
          </div>
          <span className="font-semibold text-slate-900">
            review<span className="text-cyan-700">pilot</span>
          </span>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
          <div className="mb-7">
            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-700">
              Get started
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Create your workspace
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Your first review is only a few clicks away.
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
                Email address
              </span>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-3 text-slate-400"
                  size={17}
                />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-600">
                Password
              </span>
              <div className="relative">
                <LockKeyhole
                  className="absolute left-3 top-3 text-slate-400"
                  size={17}
                />
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </label>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-semibold text-white hover:bg-cyan-950 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <>
                  Create account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <RedirectIfAuthenticated>
      <RegisterInner />
    </RedirectIfAuthenticated>
  );
}
