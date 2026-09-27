"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Box,
  ChevronDown,
  Clock3,
  Code2,
  LogOut,
  PanelLeft,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

const nav: { href: string; label: string; icon: typeof Activity; activePrefix?: string; activeExact?: boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: Activity, activeExact: true },
  { href: "/dashboard", label: "Projects", icon: Box, activePrefix: "/projects" },
  { href: "/providers", label: "AI Providers", icon: Sparkles },
  { href: "/history", label: "Review History", icon: Clock3 },
];

function initialsFromEmail(email: string): string {
  const name = email.split("@")[0] || "U";
  const alnum = name.replace(/[^A-Za-z0-9]/g, "");
  return (alnum.slice(0, 2) || name.slice(0, 2) || "U").toUpperCase();
}

export function AppShell({
  children,
  title,
  eyebrow,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const email = user?.email ?? "";
  const initials = initialsFromEmail(email);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col bg-[#101827] text-slate-300 lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-slate-950">
            <Code2 size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-white">
              review<span className="text-cyan-300">pilot</span>
            </div>
            <div className="text-[10px] uppercase tracking-[.2em] text-slate-500">
              AI code intelligence
            </div>
          </div>
        </div>
        <div className="px-4 pt-7">
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
            Workspace
          </div>
          {nav.map((item) => {
            const active = item.activeExact
              ? pathname === item.href
              : item.activePrefix
                ? pathname.startsWith(item.activePrefix)
                : pathname === item.href || pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`group mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  active
                    ? "bg-white/10 text-white shadow-inner"
                    : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  size={17}
                  className={
                    active
                      ? "text-cyan-300"
                      : "text-slate-500 group-hover:text-slate-300"
                  }
                />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300">
              <ShieldCheck size={14} className="text-emerald-300" /> API connected
            </div>
            <div className="text-[11px] leading-relaxed text-slate-500">
              FastAPI backend · localhost:8000
            </div>
          </div>
          <button className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
            <Settings2 size={17} /> Settings{" "}
            <ChevronDown size={14} className="ml-auto" />
          </button>
        </div>
      </aside>
      <div className="lg:pl-[248px]">
        <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3">
            <PanelLeft className="text-slate-400 lg:hidden" size={20} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-700">
                {eyebrow || "Workspace"}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-700">
                {email || "Signed in"}
              </div>
              <div className="text-[11px] text-slate-400">
                Developer workspace
              </div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {initials}
            </div>
            <button
              title="Log out"
              onClick={logout}
              className="text-slate-400 hover:text-slate-700"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="p-5 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
      {children}
    </div>
  );
}

export function Severity({ value }: { value: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-50 text-red-700 ring-red-100",
    high: "bg-orange-50 text-orange-700 ring-orange-100",
    medium: "bg-amber-50 text-amber-700 ring-amber-100",
    low: "bg-blue-50 text-blue-700 ring-blue-100",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${
        styles[value] || styles.low
      }`}
    >
      {value}
    </span>
  );
}
