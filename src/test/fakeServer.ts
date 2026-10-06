/**
 * Fake backend for the `http` Vitest project (PLAN.md §23.1): stubs `fetch` and `XMLHttpRequest`,
 * answers from a route table and records every request, so tests check the wire contract (method,
 * URL, headers, body) and how responses map back. A request with no route answers 501 with a
 * detail naming it, which surfaces as the AppError message.
 */

export interface RecordedRequest {
  method: string;
  /** Path plus query, as the app sent it (same origin). */
  url: string;
  headers: Record<string, string>;
  /** Parsed JSON body; FormData for uploads; undefined without a body. */
  body: unknown;
  keepalive: boolean;
  transport: "fetch" | "xhr";
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Rejects like a dropped connection instead of answering. */
  networkError?: boolean;
}

type Responder = FakeResponse | ((request: RecordedRequest) => FakeResponse);

interface Route {
  method: string;
  path: string | RegExp;
  responder: Responder;
  once: boolean;
}

let routes: Route[] = [];
let requests: RecordedRequest[] = [];

function pathOf(url: string): string {
  return url.split("?")[0] ?? url;
}

function matches(route: Route, method: string, url: string): boolean {
  if (route.method !== method) return false;
  return typeof route.path === "string" ? route.path === pathOf(url) : route.path.test(url);
}

function respond(request: RecordedRequest): FakeResponse {
  const index = routes.findIndex((route) => matches(route, request.method, request.url));
  const route = routes[index];
  if (!route) {
    return {
      status: 501,
      body: {
        code: "unknown",
        detail: `fakeServer: no route for ${request.method} ${request.url}`,
      },
    };
  }
  if (route.once) routes.splice(index, 1);
  return typeof route.responder === "function" ? route.responder(request) : route.responder;
}

function bodyText(body: unknown): string {
  if (body === undefined) return "";
  return typeof body === "string" ? body : JSON.stringify(body);
}

function parseJson(text: unknown): unknown {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function headersOf(init: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  new Headers(init).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  // Media previews (data:/blob: URLs) are read back as a Blob before uploading.
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return new Response(new Blob(["fake-bytes"], { type: "image/jpeg" }));
  }
  const request: RecordedRequest = {
    method: (init.method ?? "GET").toUpperCase(),
    url,
    headers: headersOf(init.headers),
    body: parseJson(init.body ?? undefined),
    keepalive: init.keepalive === true,
    transport: "fetch",
  };
  requests.push(request);
  const answer = respond(request);
  if (answer.networkError) throw new TypeError("Failed to fetch");
  const status = answer.status ?? 200;
  const text = status === 204 ? null : bodyText(answer.body);
  return new Response(text, { status, headers: answer.headers ?? {} });
}

interface ProgressHandler {
  onprogress: ((event: ProgressEvent) => void) | null;
}

/** Enough of XMLHttpRequest for `upload()`: headers, upload progress, load and error. */
class FakeXhr {
  method = "GET";
  url = "";
  withCredentials = false;
  status = 0;
  responseText = "";
  readonly upload: ProgressHandler = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private headers: Record<string, string> = {};
  private responseHeaders: Record<string, string> = {};

  getResponseHeader(name: string): string | null {
    return this.responseHeaders[name.toLowerCase()] ?? null;
  }

  open(method: string, url: string) {
    this.method = method.toUpperCase();
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  send(body: unknown) {
    const request: RecordedRequest = {
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      body,
      keepalive: false,
      transport: "xhr",
    };
    requests.push(request);
    const answer = respond(request);
    queueMicrotask(() => {
      if (answer.networkError) {
        this.onerror?.();
        return;
      }
      for (const loaded of [50, 100]) {
        this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 } as ProgressEvent);
      }
      this.status = answer.status ?? 200;
      this.responseText = bodyText(answer.body);
      this.responseHeaders = Object.fromEntries(
        Object.entries(answer.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
      );
      this.onload?.();
    });
  }
}

export const fakeServer = {
  /** Adds a route; the newest matching route is not preferred: the first registered wins. */
  on(method: string, path: string | RegExp, responder: Responder = { status: 204 }) {
    routes.push({ method: method.toUpperCase(), path, responder, once: false });
  },
  /** Like `on`, but answers a single request (later requests fall through to other routes). */
  once(method: string, path: string | RegExp, responder: Responder) {
    routes.push({ method: method.toUpperCase(), path, responder, once: true });
  },
  get requests(): readonly RecordedRequest[] {
    return requests;
  },
  /** The last request to a path (any method unless given). */
  last(path: string, method?: string): RecordedRequest | undefined {
    return [...requests]
      .reverse()
      .find((request) => pathOf(request.url) === path && (!method || request.method === method));
  },
  reset() {
    routes = [];
    requests = [];
  },
  install() {
    globalThis.fetch = fakeFetch as typeof fetch;
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  },
};
