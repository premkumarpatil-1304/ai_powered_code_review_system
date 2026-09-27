"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Code2, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RedirectIfAuthenticated } from "@/components/require-auth";
import { ApiError } from "@/lib/api/client";

function LoginInner() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden bg-[#101827] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-slate-950">
            <Code2 size={20} />
          </div>
          <span className="font-semibold">
            review<span className="text-cyan-300">pilot</span>
          </span>
        </div>
        <div>
          <div className="mb-5 text-sm font-medium text-cyan-300">
            AI CODE INTELLIGENCE
          </div>
          <h1 className="max-w-md text-5xl font-semibold leading-[1.05] tracking-tight">
            Ship with a second pair of eyes.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
            ReviewPilot helps engineering teams find security, performance, and
            quality issues before they reach production.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Private by design · Bring your own model
        </div>
      </div>
      <div className="flex items-center justify-center bg-[#f7f9fb] p-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-slate-950">
                <Code2 size={20} />
              </div>
              <span className="font-semibold">
                review<span className="text-cyan-700">pilot</span>
              </span>
            </div>
          </div>
          <div className="mb-8">
            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-700">
              Welcome back
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Connect to your existing code review environment.
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
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </label>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-semibold text-white transition hover:bg-cyan-950 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            New to ReviewPilot?{" "}
            <Link
              href="/register"
              className="font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <RedirectIfAuthenticated>
      <LoginInner />
    </RedirectIfAuthenticated>
  );
}
