import type { z } from "zod";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      typeof (data as any)?.error === "string"
        ? (data as any).error
        : "요청에 실패했습니다.",
      response.status,
    );
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiError("서버 응답 형식이 올바르지 않습니다.", 502);
  return parsed.data;
}
