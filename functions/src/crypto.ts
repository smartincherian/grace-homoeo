import type { KeyManagementServiceClient } from "@google-cloud/kms";
import type { Deps } from "./deps.js";

export const KMS_KEY = (project: string) =>
  `projects/${project}/locations/asia-south1/keyRings/llm-keys/cryptoKeys/clinic-api-keys`;

/** Encrypts/decrypts with the clinicId bound as AAD, so a ciphertext only opens for its own clinic. */
export function kmsCrypto(
  client: Pick<KeyManagementServiceClient, "encrypt" | "decrypt">,
  keyName: string,
): Deps["kms"] {
  return {
    async encrypt(plain, aad) {
      const [res] = await client.encrypt({
        name: keyName,
        plaintext: Buffer.from(plain, "utf8"),
        additionalAuthenticatedData: Buffer.from(aad),
      });
      return Buffer.from(res.ciphertext as Uint8Array).toString("base64");
    },
    async decrypt(cipher, aad) {
      const [res] = await client.decrypt({
        name: keyName,
        ciphertext: Buffer.from(cipher, "base64"),
        additionalAuthenticatedData: Buffer.from(aad),
      });
      return Buffer.from(res.plaintext as Uint8Array).toString("utf8");
    },
  };
}
