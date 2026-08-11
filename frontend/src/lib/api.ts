import { apiBaseUrl } from "./env";
import { supabase } from "./supabase";

async function parseApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: string };
    return new Error(body.detail ?? `API request failed: ${response.status}`);
  } catch {
    return new Error(`API request failed: ${response.status}`);
  }
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
  const accessToken = await getAccessToken();
  return apiGet<T>(path, accessToken);
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
  return apiPost<T>(path, body, accessToken);
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
  return apiPatch<T>(path, body, accessToken);
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
  return apiDelete(path, accessToken);
}

async function getAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase env není nastavené.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Chybí Supabase access token.");
  }

  return accessToken;
}
