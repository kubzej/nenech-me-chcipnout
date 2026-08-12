import { apiBaseUrl } from "./env";
import { supabase } from "./supabase";

const AUTHED_GET_CACHE_TTL_MS = 30_000;

type AuthedGetCacheEntry = {
  expiresAt: number;
  promise?: Promise<unknown>;
  value?: unknown;
};

const authedGetCache = new Map<string, AuthedGetCacheEntry>();

async function parseApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return new Error(
      formatErrorDetail(body.detail) ?? `API request failed: ${response.status}`,
    );
  } catch {
    return new Error(`API request failed: ${response.status}`);
  }
}

function formatErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) {
          return null;
        }
        const loc = Array.isArray((item as { loc?: unknown }).loc)
          ? (item as { loc: unknown[] }).loc
              .filter((part) => part !== "body")
              .join(".")
          : null;
        const msg = String((item as { msg: unknown }).msg);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : undefined;
  }

  return undefined;
}

export async function apiGet<T>(path: string, accessToken?: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiGetAuthed<T>(path: string): Promise<T> {
  const { accessToken, userId } = await getAuthContext();
  const cacheKey = `${userId}:${path}`;
  const cached = authedGetCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    if (cached.promise) {
      return cached.promise as Promise<T>;
    }

    return cached.value as T;
  }

  const promise = apiGet<T>(path, accessToken)
    .then((value) => {
      authedGetCache.set(cacheKey, {
        expiresAt: Date.now() + AUTHED_GET_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .catch((error: unknown) => {
      authedGetCache.delete(cacheKey);
      throw error;
    });

  authedGetCache.set(cacheKey, {
    expiresAt: now + AUTHED_GET_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

export function clearApiCache() {
  authedGetCache.clear();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPostAuthed<T>(path: string, body: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  const result = await apiPost<T>(path, body, accessToken);
  clearApiCache();
  return result;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPatchAuthed<T>(path: string, body: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  const result = await apiPatch<T>(path, body, accessToken);
  clearApiCache();
  return result;
}

export async function apiDelete(path: string, accessToken?: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export async function apiDeleteAuthed(path: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiDelete(path, accessToken);
  clearApiCache();
}

async function getAccessToken(): Promise<string> {
  return (await getAuthContext()).accessToken;
}

async function getAuthContext(): Promise<{ accessToken: string; userId: string }> {
  if (!supabase) {
    throw new Error("Supabase env není nastavené.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const session = data.session;
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Chybí Supabase access token.");
  }

  return {
    accessToken,
    userId: session.user.id,
  };
}
