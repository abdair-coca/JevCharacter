import { normalizePhone, validateEnrollment } from "../src/features/enrollment/validation.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
};

type EnrollmentRow = { name: string; phone: string; language: "es" | "en" };

const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
// One person enrolls once; a few retries after a failure still fit.
const MAX_REQUESTS_PER_WINDOW = 5;
const UPSTREAM_TIMEOUT_MS = 8_000;
const BODY_KEYS = new Set(["name", "phone", "language", "consent"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function parseBody(value: unknown): EnrollmentRow | null {
  if (!isRecord(value) || !Object.keys(value).every((key) => BODY_KEYS.has(key))) return null;
  const { name, phone, language, consent } = value;
  if (typeof name !== "string" || typeof phone !== "string" || typeof consent !== "boolean") return null;
  if (language !== "es" && language !== "en") return null;
  const normalized = normalizePhone(phone);
  if (!normalized || Object.keys(validateEnrollment({ name, phone, consent })).length > 0) return null;
  return { name: name.trim(), phone: normalized, language };
}

function clientKey(request: ApiRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [id, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(id);
    }
    if (rateBuckets.size > 1000) rateBuckets.clear();
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function supabaseTarget() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return { endpoint: `${url.replace(/\/+$/, "")}/rest/v1/enrollments`, key };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (isRateLimited(clientKey(request))) {
    return response.status(429).json({ error: "Enrollment rate exceeded" });
  }

  const row = parseBody(request.body);
  if (!row) return response.status(400).json({ error: "Invalid enrollment" });

  const target = supabaseTarget();
  if (!target) return response.status(503).json({ error: "Enrollment unavailable" });

  // The secret key bypasses RLS, so it only lives here; the visitor's details are never logged.
  try {
    const upstream = await fetch(target.endpoint, {
      method: "POST",
      headers: { apikey: target.key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return response.status(502).json({ error: "Enrollment unavailable" });
    return response.status(201).json({ saved: true });
  } catch {
    return response.status(502).json({ error: "Enrollment unavailable" });
  }
}
