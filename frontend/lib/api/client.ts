export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type User = { id: string; email: string; created_at: string };
export type Project = { id: string; name: string; description?: string; created_at: string };
export type FileNode = {
  id: string;
  name: string;
  path: string;
  is_directory: boolean;
  extension?: string | null;
  language?: string | null;
  size?: number | null;
  children: FileNode[];
};
export type Provider = {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  model_name: string;
  is_default: boolean;
  has_api_key: boolean;
  created_at: string;
};
export type ReviewTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string;
  focus_areas: string[];
};
export type ReviewIssue = {
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  description: string;
  recommendation: string;
};
export type Review = {
  id: string;
  project_id: string;
  template_id: string;
  provider_id: string;
  scope: string;
  target_file_ids: string[];
  status: "pending" | "completed" | "failed";
  summary: string | null;
  issues: ReviewIssue[] | null;
  recommendations: string[] | null;
  error_message?: string | null;
  created_at: string;
};
export type UploadResult = {
  file_count: number;
  ignored_count: number;
};
export type FilePreview = {
  id: string;
  name: string;
  path: string;
  language: string | null;
  size: number | null;
  content: string | null;
  is_binary: boolean;
  truncated: boolean;
};
export type TestConnectionResult = {
  success: boolean;
  message: string;
  latency_ms: number | null;
};
export type ProviderModel = { id: string };
export type ProviderModelsResponse = { models: ProviderModel[] };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "review_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function formatDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = (item as { loc?: (string | number)[] }).loc;
          const locStr = loc && loc.length ? ` (${loc.filter((x) => x !== "body").join(".")})` : "";
          return `${(item as { msg: string }).msg}${locStr}`;
        }
        return String(item);
      })
      .join("; ");
  }
  if (typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  explicitToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = explicitToken ?? readToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      const detailStr = formatDetail(body.detail ?? body.message);
      if (detailStr) message = detailStr;
    } catch {
      // ignore parse error
    }
    if (res.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
