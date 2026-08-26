"use client";

// client fetch helper — same-origin cookies, uniform error shape

export interface ApiError extends Error {
  status: number;
  code?: string;
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  let payload: { ok: boolean; data?: T; error?: { message: string; code?: string } } | null =
    null;
  try {
    payload = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok || !payload?.ok) {
    const err = new Error(
      payload?.error?.message ?? `خطای سرور (${res.status})`,
    ) as ApiError;
    err.status = res.status;
    err.code = payload?.error?.code;
    throw err;
  }
  return payload.data as T;
}
