import { apiBaseUrl } from "./env";

export async function apiGet<T>(path: string, accessToken?: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

