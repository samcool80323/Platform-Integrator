const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

interface GHLClientOptions {
  token: string;
  maxRetries?: number;
}

interface GHLError {
  status: number;
  message: string;
  data?: unknown;
}

export class GHLClient {
  private token: string;
  private maxRetries: number;

  constructor(opts: GHLClientOptions) {
    this.token = opts.token;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  updateToken(token: string) {
    this.token = token;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, GHL_BASE_URL);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val);
      }
    }
    return this.request<T>("GET", url.toString());
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = new URL(path, GHL_BASE_URL);
    return this.request<T>("POST", url.toString(), body);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = new URL(path, GHL_BASE_URL);
    return this.request<T>("PUT", url.toString(), body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const url = new URL(path, GHL_BASE_URL);
    return this.request<T>("DELETE", url.toString());
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    let lastError: GHLError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise((r) => setTimeout(r, delay));
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Version: GHL_API_VERSION,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        const text = await res.text();
        return text ? JSON.parse(text) : ({} as T);
      }

      // Rate limited — retry
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000));
        }
        continue;
      }

      // Server error — retry
      if (res.status >= 500 && attempt < this.maxRetries) {
        lastError = {
          status: res.status,
          message: `Server error: ${res.status}`,
          data: await res.text().catch(() => null),
        };
        continue;
      }

      // Client error — don't retry
      const errorBody = await res.text().catch(() => "");
      let detail = "";
      try {
        const parsed = errorBody ? JSON.parse(errorBody) : null;
        detail = parsed?.message || parsed?.error || (parsed ? JSON.stringify(parsed) : "");
      } catch {
        detail = errorBody;
      }
      const err = new Error(`GHL API error ${res.status}${detail ? `: ${detail}` : ""}`);
      (err as unknown as GHLError).status = res.status;
      (err as unknown as GHLError).data = errorBody;
      throw err;
    }

    if (lastError) {
      const err = new Error(lastError.message);
      (err as unknown as GHLError).status = lastError.status;
      (err as unknown as GHLError).data = lastError.data;
      throw err;
    }
    throw new Error("Max retries exceeded");
  }
}
