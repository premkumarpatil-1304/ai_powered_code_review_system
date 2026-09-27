"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Server,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { AppShell, SectionLabel } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import {
  ApiError,
  Provider,
  TestConnectionResult,
  api,
} from "@/lib/api/client";

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  openai: "OpenAI",
  lm_studio: "LM Studio",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  custom: "Custom",
};

type ProviderPreset = {
  label: string;
  base_url: string;
  model_placeholder: string;
  api_key_required: boolean;
  api_key_hint: string;
};

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  lm_studio: {
    label: "LM Studio",
    base_url: "http://localhost:1234/v1",
    model_placeholder: "e.g. microsoft-phi-4-mini-instruct",
    api_key_required: false,
    api_key_hint: "Optional — LM Studio local server does not require a key",
  },
  openai: {
    label: "OpenAI",
    base_url: "https://api.openai.com/v1",
    model_placeholder: "gpt-4o, gpt-4o-mini, gpt-3.5-turbo",
    api_key_required: true,
    api_key_hint: "Required — create one at platform.openai.com/api-keys",
  },
  openrouter: {
    label: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    model_placeholder: "e.g. anthropic/claude-sonnet-4, openai/gpt-4o",
    api_key_required: true,
    api_key_hint: "Required — create one at openrouter.ai/keys",
  },
  ollama: {
    label: "Ollama",
    base_url: "http://localhost:11434/v1",
    model_placeholder: "e.g. qwen2.5-coder:7b, llama3.1:8b",
    api_key_required: false,
    api_key_hint: "Optional — Ollama local server does not require a key",
  },
  custom: {
    label: "Custom",
    base_url: "",
    model_placeholder: "model name reported by the endpoint",
    api_key_required: false,
    api_key_hint: "Depends on your endpoint — leave empty for anonymous local servers",
  },
};

function presetFor(type: string): ProviderPreset {
  return PROVIDER_PRESETS[type] ?? PROVIDER_PRESETS.custom;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field"
      />
    </label>
  );
}

function ProvidersInner() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    Record<string, TestConnectionResult>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState("lm_studio");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState("");

  const [previewTesting, setPreviewTesting] = useState(false);
  const [previewTestResult, setPreviewTestResult] = useState<TestConnectionResult | null>(null);
  const [previewFetchingModels, setPreviewFetchingModels] = useState(false);
  const [previewModels, setPreviewModels] = useState<string[]>([]);
  const [previewModelsError, setPreviewModelsError] = useState("");

  const [showingModelsForId, setShowingModelsForId] = useState<string | null>(null);
  const [savedProviderModels, setSavedProviderModels] = useState<Record<string, string[]>>({});
  const [fetchingSavedModels, setFetchingSavedModels] = useState<string | null>(null);

  // Auto-fill Base URL from the selected preset whenever provider type changes.
  useEffect(() => {
    const preset = presetFor(providerType);
    if (preset.base_url) {
      setBaseUrl(preset.base_url);
    }
    // Wipe stale preview artifacts for the previous provider type.
    setPreviewTestResult(null);
    setPreviewModels([]);
    setPreviewModelsError("");
  }, [providerType]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const list = await api<Provider[]>("/api/providers");
        if (!cancelled) setProviders(list);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load providers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setName("");
    setProviderType("lm_studio");
    setBaseUrl("");
    setModelName("");
    setApiKey("");
    setIsDefault(false);
    setFormError("");
    setPreviewTestResult(null);
    setPreviewModels([]);
    setPreviewModelsError("");
  }

  function previewPayload() {
    return {
      name: name.trim() || "Preview",
      provider_type: providerType,
      base_url: baseUrl.trim(),
      model_name: modelName.trim(),
      api_key: apiKey.trim() || undefined,
      is_default: false,
    };
  }

  async function fetchPreviewModels() {
    setPreviewFetchingModels(true);
    setPreviewModelsError("");
    setPreviewModels([]);
    try {
      const res = await api<{ models: { id: string }[] }>("/api/providers/models-preview", {
        method: "POST",
        body: JSON.stringify(previewPayload()),
      });
      setPreviewModels((res.models || []).map((m) => m.id));
    } catch (err) {
      setPreviewModelsError(
        err instanceof ApiError ? err.message : "Model discovery failed",
      );
    } finally {
      setPreviewFetchingModels(false);
    }
  }

  async function testPreviewConnection() {
    setPreviewTesting(true);
    setPreviewTestResult(null);
    try {
      const result = await api<TestConnectionResult>("/api/providers/test-preview", {
        method: "POST",
        body: JSON.stringify(previewPayload()),
      });
      setPreviewTestResult(result);
    } catch (err) {
      setPreviewTestResult({
        success: false,
        message: err instanceof ApiError ? err.message : "Test request failed",
        latency_ms: null,
      });
    } finally {
      setPreviewTesting(false);
    }
  }

  async function fetchSavedProviderModels(id: string) {
    setFetchingSavedModels(id);
    setShowingModelsForId((cur) => (cur === id ? null : id));
    try {
      const res = await api<{ models: { id: string }[] }>(`/api/providers/${id}/models`);
      setSavedProviderModels((prev) => ({
        ...prev,
        [id]: (res.models || []).map((m) => m.id),
      }));
    } catch {
      setSavedProviderModels((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setFetchingSavedModels(null);
    }
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const created = await api<Provider>("/api/providers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          provider_type: providerType,
          base_url: baseUrl.trim(),
          model_name: modelName.trim(),
          api_key: apiKey.trim() || undefined,
          is_default: isDefault,
        }),
      });
      setProviders((prev) => {
        const list = isDefault
          ? prev.map((p) => ({ ...p, is_default: false }))
          : prev;
        return [...list, created];
      });
      resetForm();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add provider");
    } finally {
      setSubmitting(false);
    }
  }

  async function setProviderDefault(id: string) {
    const target = providers.find((p) => p.id === id);
    if (!target) return;
    setProviders((prev) => prev.map((p) => ({ ...p, is_default: p.id === id })));
    try {
      await api<Provider>(`/api/providers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_default: true }),
      });
    } catch (err) {
      setProviders((prev) =>
        prev.map((p) => ({ ...p, is_default: target ? target.is_default : p.is_default })),
      );
      setError(err instanceof ApiError ? err.message : "Failed to update provider");
    }
  }

  async function deleteProvider(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/providers/${id}`, { method: "DELETE" });
      setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete provider");
    } finally {
      setDeletingId(null);
    }
  }

  async function testConnection(id: string) {
    setTesting(id);
    setTestResult((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await api<TestConnectionResult>(
        `/api/providers/${id}/test`,
        { method: "POST", body: "{}" },
      );
      setTestResult((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message:
            err instanceof ApiError ? err.message : "Test request failed",
          latency_ms: null,
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <AppShell title="AI Providers" eyebrow="Configuration">
      <div className="mx-auto max-w-[1180px] space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Models that work your way.
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Connect any OpenAI-compatible endpoint. API keys are stored securely
            and never returned by the API.
          </p>
        </div>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700"
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <section className="space-y-4">
            <SectionLabel>Connected providers · {providers.length}</SectionLabel>
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm flex items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Loader2 size={17} className="animate-spin text-cyan-600" />
                  Loading providers…
                </div>
              </div>
            ) : providers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                  <Server size={22} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800">
                  No providers connected
                </h3>
                <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-slate-500">
                  Add your first AI provider using the form on the right to start
                  running reviews.
                </p>
              </div>
            ) : (
              providers.map((p) => {
                const t = testResult[p.id];
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                          <Server size={19} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {p.name}
                            {p.is_default && (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs capitalize text-slate-400">
                            {PROVIDER_TYPE_LABELS[p.provider_type] ??
                              p.provider_type.replace("_", " ")}{" "}
                            · {p.model_name}
                          </div>
                          {!p.has_api_key && (
                            <div className="mt-1 text-[11px] text-amber-700">
                              ⚠ No API key stored — connection may fail.
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteProvider(p.id)}
                        disabled={deletingId === p.id}
                        className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                        title="Delete provider"
                      >
                        {deletingId === p.id ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Trash2 size={17} />
                        )}
                      </button>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            t ? (t.success ? "bg-emerald-400" : "bg-red-400") : "bg-slate-300"
                          }`}
                        />
                        {p.base_url}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {t && (
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              t.success
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                : "bg-red-50 text-red-700 ring-1 ring-red-100"
                            }`}
                            title={t.message}
                          >
                            {t.success ? (
                              <>
                                <CheckCircle2
                                  size={11}
                                  className="inline mr-1 -mt-0.5"
                                />
                                OK
                              </>
                            ) : (
                              "Failed"
                            )}
                            {typeof t.latency_ms === "number"
                              ? ` · ${t.latency_ms}ms`
                              : ""}
                          </span>
                        )}
                        <button
                          onClick={() => testConnection(p.id)}
                          disabled={testing === p.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {testing === p.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Wifi size={14} />
                          )}
                          {testing === p.id ? "Testing…" : "Test connection"}
                        </button>
                        <button
                          onClick={() => fetchSavedProviderModels(p.id)}
                          disabled={fetchingSavedModels === p.id}
                          title="List available models on this provider"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {fetchingSavedModels === p.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Server size={14} />
                          )}
                          Models
                        </button>
                        {!p.is_default && (
                          <button
                            onClick={() => setProviderDefault(p.id)}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                          >
                            Set default
                          </button>
                        )}
                      </div>
                    </div>
                    {showingModelsForId === p.id && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                        <div className="mb-2 font-semibold text-slate-600">
                          Available models on this provider:
                        </div>
                        {fetchingSavedModels === p.id ? (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 size={13} className="animate-spin" />
                            Fetching…
                          </div>
                        ) : (savedProviderModels[p.id] ?? []).length === 0 ? (
                          <div className="text-slate-500">
                            No models returned. Make sure the server is running and
                            models are loaded, then try again.
                          </div>
                        ) : (
                          <ul className="max-h-56 overflow-auto space-y-1">
                            {(savedProviderModels[p.id] ?? []).map((m) => (
                              <li
                                key={m}
                                className="truncate rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200"
                                title={m}
                              >
                                {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
          <section>
            <SectionLabel>Add a provider</SectionLabel>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <form onSubmit={addProvider} className="grid gap-4">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
                <Field
                  label="Display name"
                  value={name}
                  onChange={setName}
                  placeholder="My coding model"
                  required
                />
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-600">
                    Provider type
                    <span className="text-red-500 ml-0.5">*</span>
                  </span>
                  <select
                    className="field"
                    value={providerType}
                    onChange={(e) => setProviderType(e.target.value)}
                    required
                  >
                    <option value="lm_studio">LM Studio (free · local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="ollama">Ollama (free · local)</option>
                    <option value="custom">Custom OpenAI-compatible</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {presetFor(providerType).base_url
                      ? `Preset Base URL: ${presetFor(providerType).base_url}`
                      : "Enter your endpoint URL below."}
                  </p>
                </label>
                <Field
                  label="Base URL"
                  value={baseUrl}
                  onChange={setBaseUrl}
                  placeholder={
                    presetFor(providerType).base_url ||
                    "https://your-endpoint.example.com/v1"
                  }
                  required
                />
                <div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold text-slate-600">
                      Model name
                      <span className="text-red-500 ml-0.5">*</span>
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder={presetFor(providerType).model_placeholder}
                      className="field flex-1"
                    />
                    <button
                      type="button"
                      onClick={fetchPreviewModels}
                      disabled={previewFetchingModels || !baseUrl.trim()}
                      title="Fetch available models from the provider endpoint"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {previewFetchingModels ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Server size={14} />
                      )}
                      Fetch
                    </button>
                  </div>
                  {previewModelsError && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      {previewModelsError} — you can still type a model name manually.
                    </div>
                  )}
                  {previewModels.length > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Click to select · {previewModels.length} available
                      </div>
                      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
                        {previewModels.map((m) => {
                          const selected = m === modelName;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setModelName(m)}
                              className={
                                "truncate rounded-md px-2 py-1 font-mono text-[10px] ring-1 transition " +
                                (selected
                                  ? "bg-cyan-600 text-white ring-cyan-600"
                                  : "bg-white text-slate-700 ring-slate-200 hover:bg-cyan-50 hover:text-cyan-800")
                              }
                              title={m}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-600">
                    API key{" "}
                    <span
                      className={
                        "font-normal " +
                        (presetFor(providerType).api_key_required
                          ? "text-red-500"
                          : "text-slate-400")
                      }
                    >
                      (
                      {presetFor(providerType).api_key_required
                        ? "required"
                        : "optional for local"}
                      )
                    </span>
                  </span>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        presetFor(providerType).api_key_required
                          ? "Paste your API key…"
                          : "Leave blank for LM Studio / local servers"
                      }
                      className="field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {presetFor(providerType).api_key_hint}
                  </p>
                </label>
                <label className="mt-1 flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    className="accent-cyan-600"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  Set as default provider
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={testPreviewConnection}
                    disabled={previewTesting || !baseUrl.trim() || !modelName.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {previewTesting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Wifi size={14} />
                    )}
                    {previewTesting ? "Testing connection…" : "Test connection (before save)"}
                  </button>
                  {previewTestResult && (
                    <div
                      className={
                        "rounded-xl border px-4 py-3 text-xs " +
                        (previewTestResult.success
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700")
                      }
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {previewTestResult.success ? (
                          <>
                            <CheckCircle2 size={14} />
                            Connection successful
                          </>
                        ) : (
                          "Connection failed"
                        )}
                        {typeof previewTestResult.latency_ms === "number" && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            · {previewTestResult.latency_ms}ms
                          </span>
                        )}
                      </div>
                      <div className="mt-1 leading-5">{previewTestResult.message}</div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !baseUrl.trim() || !modelName.trim()}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-cyan-950 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {submitting ? "Adding…" : "Add provider"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function Providers() {
  return (
    <RequireAuth>
      <ProvidersInner />
    </RequireAuth>
  );
}
