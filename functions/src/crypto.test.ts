import { describe, it, expect } from "vitest";
import { kmsCrypto, KMS_KEY } from "./crypto.js";

describe("kmsCrypto", () => {
  it("builds the key name", () => {
    expect(KMS_KEY("p")).toBe("projects/p/locations/asia-south1/keyRings/llm-keys/cryptoKeys/clinic-api-keys");
  });
  it("encrypts with clinicId AAD and returns base64", async () => {
    let seen: any;
    const client: any = {
      encrypt: async (req: any) => {
        seen = req;
        return [{ ciphertext: Buffer.from("CIPHER") }];
      },
    };
    const out = await kmsCrypto(client, "key")["encrypt"]("secret", "c1");
    expect(out).toBe(Buffer.from("CIPHER").toString("base64"));
    expect(seen.name).toBe("key");
    expect(Buffer.from(seen.plaintext).toString()).toBe("secret");
    expect(Buffer.from(seen.additionalAuthenticatedData).toString()).toBe("c1");
  });
  it("decrypts with the same AAD and returns utf8", async () => {
    let seen: any;
    const client: any = {
      decrypt: async (req: any) => {
        seen = req;
        return [{ plaintext: Buffer.from("secret") }];
      },
    };
    const out = await kmsCrypto(client, "key").decrypt(Buffer.from("CIPHER").toString("base64"), "c1");
    expect(out).toBe("secret");
    expect(Buffer.from(seen.ciphertext).toString()).toBe("CIPHER");
    expect(Buffer.from(seen.additionalAuthenticatedData).toString()).toBe("c1");
  });
});
