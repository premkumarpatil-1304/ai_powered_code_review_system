"use client";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowUp, Bot, Code2, Loader2, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { ApiError, api } from "@/lib/api/client";

type ChatMessage = { role: "user" | "assistant"; content: string };

function ChatInner() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [projectName, setProjectName] = useState("Project");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I’m ready to help you understand this project. Ask about architecture, a file, or a finding from your latest review.",
    },
  ]);
  const [backendDisabled, setBackendDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadName() {
      try {
        const p = await api<{ name: string }>(`/api/projects/${projectId}`);
        if (!cancelled) setProjectName(p.name);
      } catch {
        /* ignore */
      }
    }
    loadName();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function ensureSession(firstMessage: string): Promise<string | null> {
    if (sessionId) return sessionId;
    setSessionCreating(true);
    try {
      const sess = await api<{ id: string; title?: string }>(
        `/api/projects/${projectId}/chat/sessions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: firstMessage.slice(0, 60) || "Project chat",
          }),
        },
      );
      setSessionId(sess.id);
      return sess.id;
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 404) setBackendDisabled(true);
      return null;
    } finally {
      setSessionCreating(false);
    }
  }

  async function loadHistory(sid: string) {
    try {
      const list = (await api<
        { role: "user" | "assistant"; content: string }[]
      >(`/api/chat/${sid}/messages`)) as ChatMessage[];
      if (Array.isArray(list) && list.length) setMessages(list);
    } catch {
      /* ignore */
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    const withUser = [...messages, { role: "user" as const, content: text }];
    setMessages(withUser);
    setInput("");
    setSending(true);

    if (backendDisabled) {
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Chat is not enabled on the backend yet. Once chat routes are available, I’ll return a context-aware answer for this repository.",
          },
        ]);
        setSending(false);
      }, 600);
      return;
    }

    const sid = await ensureSession(text);
    if (!sid) {
      // 404 or backend not available — fall back to local placeholder
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Chat is not enabled on the backend yet. Once chat routes are available, I’ll return a context-aware answer for this repository.",
          },
        ]);
        setSending(false);
      }, 400);
      return;
    }

    if (!sessionId) {
      // just set; we'll send the message below
      void loadHistory(sid).catch(() => {});
    }

    try {
      await api(`/api/chat/${sid}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      const reply = (await api<ChatMessage[]>(`/api/chat/${sid}/messages`)) as ChatMessage[];
      if (Array.isArray(reply) && reply.length) {
        setMessages(reply);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "No response from the assistant." },
        ]);
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 404) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Chat is not enabled on the backend yet. Once chat routes are available, I’ll return a context-aware answer for this repository.",
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Chat error: ${e.message}`,
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell title="Project chat" eyebrow={projectName}>
      <div
        className="mx-auto flex max-w-[960px] flex-col"
        style={{ height: "calc(100vh - 170px)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-cyan-800">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold">Ask about {projectName}</h2>
            <p className="text-xs text-slate-500">
              Context-aware help for your codebase
            </p>
          </div>
          {sessionCreating && (
            <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Creating session…
            </span>
          )}
          {backendDisabled && (
            <span className="ml-auto rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
              Backend chat unavailable
            </span>
          )}
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex max-w-[75%] gap-3 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    m.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-cyan-50 text-cyan-700"
                  }`}
                >
                  {m.role === "user" ? <UserRound size={15} /> : <Code2 size={15} />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                    m.role === "user"
                      ? "rounded-tr-sm bg-slate-900 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-700"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Thinking…
            </div>
          )}
        </div>
        <form
          onSubmit={send}
          className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this project…"
            className="flex-1 bg-transparent px-3 text-sm outline-none"
          />
          <button
            disabled={!input.trim() || sending}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white hover:bg-cyan-950 disabled:opacity-40"
            title="Send"
          >
            <ArrowUp size={17} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

export default function Chat() {
  return (
    <RequireAuth>
      <ChatInner />
    </RequireAuth>
  );
}
