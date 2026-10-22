import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;
const TIMEOUT_MS = 30_000;
const GENERIC = "The summary couldn't be generated, try again.";

const outputSchema = z.object({
  bullets: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});

export function mapGeminiStatus(status: number, context: "save" | "summarize"): HttpsError {
  if (status === 400 || status === 401 || status === 403) {
    const msg =
      context === "save"
        ? "That key was rejected by Gemini."
        : "The clinic's Gemini key was rejected. Ask the owner to replace it in Settings.";
    return new HttpsError("failed-precondition", msg, { reason: "key-rejected" });
  }
  if (status === 429) {
    return new HttpsError("resource-exhausted", "Gemini quota reached for this key, try again later.");
  }
  return new HttpsError("internal", GENERIC);
}

/** Checks the key with a cheap GET. Gemini response bodies are never read into errors. */
export async function validateGeminiKey(f: typeof fetch, key: string): Promise<void> {
  let res: Response;
  try {
    res = await f(BASE, {
      method: "GET",
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpsError("internal", "Couldn't reach Gemini, try again.");
  }
  if (!res.ok) throw mapGeminiStatus(res.status, "save");
}

export async function generateBullets(
  f: typeof fetch,
  key: string,
  system: string,
  record: string,
): Promise<string[]> {
  let res: Response;
  try {
    res = await f(`${BASE}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: record }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { bullets: { type: "ARRAY", items: { type: "STRING" } } },
            required: ["bullets"],
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpsError("internal", GENERIC);
  }
  if (!res.ok) throw mapGeminiStatus(res.status, "summarize");
  try {
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("no text");
    return outputSchema.parse(JSON.parse(text)).bullets;
  } catch {
    throw new HttpsError("internal", GENERIC);
  }
}
