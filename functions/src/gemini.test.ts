import { describe, it, expect } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { generateBullets, validateGeminiKey, mapGeminiStatus, GEMINI_MODEL } from "./gemini";

const KEY = "AIzaSECRET123";
const GENERIC = "The summary couldn't be generated, try again.";

type Call = { url: string; init: RequestInit };
function fake(res: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return res();
  }) as unknown as typeof fetch;
  return { f, calls };
}
const okBody = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const bullets = (n: number, len = 10) => JSON.stringify({ bullets: Array.from({ length: n }, () => "x".repeat(len)) });
const status = (s: number) => new Response(`{"error":{"message":"leak ${KEY}"}}`, { status: s });

async function err(p: Promise<unknown>): Promise<HttpsError> {
  try {
    await p;
  } catch (e) {
    return e as HttpsError;
  }
  throw new Error("did not throw");
}

describe("gemini client", () => {
  it("sends key in header, never in URL", async () => {
    const { f, calls } = fake(() => okBody(bullets(3)));
    await generateBullets(f, KEY, "sys", "rec");
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].url).toContain(`${GEMINI_MODEL}:generateContent`);
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "rec" }] }]);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.maxOutputTokens).toBe(600);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("validate sends key in header on GET", async () => {
    const { f, calls } = fake(() => new Response("{}", { status: 200 }));
    await validateGeminiKey(f, KEY);
    expect(calls[0].url).not.toContain(KEY);
    expect((calls[0].init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    expect(calls[0].init.method).toBe("GET");
  });

  it("returns trimmed bullets", async () => {
    const { f } = fake(() => okBody(JSON.stringify({ bullets: ["  a ", "b", " c"] })));
    expect(await generateBullets(f, KEY, "s", "r")).toEqual(["a", "b", "c"]);
  });

  it("maps statuses", async () => {
    let e = await err(generateBullets(fake(() => status(401)).f, KEY, "s", "r"));
    expect(e.code).toBe("failed-precondition");
    expect(e.message).toBe("The clinic's Gemini key was rejected. Ask the owner to replace it in Settings.");
    expect(e.details).toEqual({ reason: "key-rejected" });
    e = await err(validateGeminiKey(fake(() => status(403)).f, KEY));
    expect(e.message).toBe("That key was rejected by Gemini.");
    expect(e.details).toEqual({ reason: "key-rejected" });
    e = await err(generateBullets(fake(() => status(429)).f, KEY, "s", "r"));
    expect(e.code).toBe("resource-exhausted");
    expect(e.message).toBe("Gemini quota reached for this key, try again later.");
    e = await err(generateBullets(fake(() => status(500)).f, KEY, "s", "r"));
    expect(e.code).toBe("internal");
    expect(mapGeminiStatus(400, "save").message).toBe("That key was rejected by Gemini.");
  });

  const bad: [string, () => Response][] = [
    ["empty candidates", () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })],
    ["blockReason", () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })],
    ["non-JSON", () => okBody("not json")],
    ["2 bullets", () => okBody(bullets(2))],
    ["9 bullets", () => okBody(bullets(9))],
    ["301 chars", () => okBody(bullets(3, 301))],
    ["empty bullet", () => okBody(JSON.stringify({ bullets: ["a", "b", "  "] }))],
  ];
  for (const [name, res] of bad) {
    it(`${name} -> internal generic`, async () => {
      const e = await err(generateBullets(fake(res).f, KEY, "s", "r"));
      expect(e.code).toBe("internal");
      expect(e.message).toBe(GENERIC);
    });
  }

  it("fetch throws -> internal, no key leak", async () => {
    const f = (async () => {
      throw new Error(`timeout ${KEY}`);
    }) as unknown as typeof fetch;
    const e = await err(generateBullets(f, KEY, "s", "r"));
    expect(e.code).toBe("internal");
    const v = await err(validateGeminiKey(f, KEY));
    expect(v.code).toBe("internal");
    expect(v.message).toBe("Couldn't reach Gemini, try again.");
  });

  it("no error contains the key", async () => {
    const throwing = (async () => {
      throw new Error(KEY);
    }) as unknown as typeof fetch;
    const cases: (() => Promise<unknown>)[] = [
      ...[400, 401, 403, 429, 500].flatMap((s) => [
        () => generateBullets(fake(() => status(s)).f, KEY, "s", "r"),
        () => validateGeminiKey(fake(() => status(s)).f, KEY),
      ]),
      ...bad.map(([, r]) => () => generateBullets(fake(r).f, KEY, "s", "r")),
      () => generateBullets(throwing, KEY, "s", "r"),
      () => validateGeminiKey(throwing, KEY),
    ];
    for (const c of cases) {
      const e = await err(c());
      expect(e.message).not.toContain(KEY);
      expect(JSON.stringify(e)).not.toContain(KEY);
    }
  });
});
