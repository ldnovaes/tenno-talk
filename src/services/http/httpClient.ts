import { AppError } from "@/lib/errors";

import { problemToAppError } from "./problem";

/**
 * The only place that talks HTTP (PLAN.md §16). Same origin as the SPA: the session is an
 * HttpOnly cookie and CSRF goes back as X-XSRF-TOKEN, read from the XSRF-TOKEN cookie.
 */
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Query = Record<string, string | number | null | undefined>;

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";

export function readCookie(name: string, cookies: string = document.cookie): string | null {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function withQuery(path: string, query: Query | undefined): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function csrfHeaders(method: Method): Record<string, string> {
  if (method === "GET") return {};
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

const NETWORK_ERROR = "Connection problem. Check your internet and try again.";

/** JSON request; resolves with the parsed body (typed by the caller) or rejects with AppError. */
export async function http<T>(
  method: Method,
  path: string,
  options: { body?: unknown; query?: Query; accountId?: string; keepalive?: boolean } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(withQuery(path, options.query), {
      method,
      credentials: "same-origin",
      ...(options.keepalive ? { keepalive: true } : {}),
      headers: {
        Accept: "application/json",
        ...(options.accountId ? { "X-Tenno-User": options.accountId } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...csrfHeaders(method),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (cause) {
    throw new AppError("network", NETWORK_ERROR, { cause });
  }
  const body = await readBody(response);
  if (!response.ok) throw problemToAppError(response.status, body);
  return body as T;
}

/** Multipart upload with progress (fetch has no upload progress). */
export function upload<T>(
  path: string,
  file: Blob,
  fileName: string,
  onProgress?: (fraction: number) => void,
  accountId?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", path);
    request.withCredentials = true;
    if (accountId) request.setRequestHeader("X-Tenno-User", accountId);
    request.setRequestHeader("Accept", "application/json");
    const token = readCookie(CSRF_COOKIE);
    if (token) request.setRequestHeader(CSRF_HEADER, token);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    request.onerror = () => reject(new AppError("network", NETWORK_ERROR));
    request.onload = () => {
      let body: unknown = undefined;
      try {
        body = request.responseText ? (JSON.parse(request.responseText) as unknown) : undefined;
      } catch {
        body = request.responseText;
      }
      if (request.status >= 200 && request.status < 300) resolve(body as T);
      else reject(problemToAppError(request.status, body));
    };
    const form = new FormData();
    form.append("file", file, fileName);
    request.send(form);
  });
}
