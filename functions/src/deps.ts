import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { kmsCrypto, KMS_KEY } from "./crypto.js";

export const SUPER = "smartin.cherian@gmail.com";

/** Thin wrapper over admin Firestore, easy to fake in tests. Paths are full document/collection paths. */
export interface Store {
  get(path: string): Promise<Record<string, unknown> | null>;
  set(path: string, data: Record<string, unknown>): Promise<void>;
  delete(path: string): Promise<void>;
  query(collection: string, field: string, value: string): Promise<Record<string, unknown>[]>;
  transaction<T>(fn: (tx: { get: Store["get"]; set: Store["set"] }) => Promise<T>): Promise<T>;
}

export interface Deps {
  store: Store;
  kms: {
    encrypt(plain: string, aad: string): Promise<string>;
    decrypt(cipher: string, aad: string): Promise<string>;
  };
  fetch: typeof fetch;
  now(): number;
}

export function realDeps(): Deps {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const store: Store = {
    async get(path) {
      const snap = await db.doc(path).get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async set(path, data) {
      await db.doc(path).set(data);
    },
    async delete(path) {
      await db.doc(path).delete();
    },
    async query(collection, field, value) {
      const snap = await db.collection(collection).where(field, "==", value).get();
      return snap.docs.map((d) => d.data() as Record<string, unknown>);
    },
    transaction(fn) {
      return db.runTransaction((t) =>
        fn({
          async get(path) {
            const snap = await t.get(db.doc(path));
            return snap.exists ? (snap.data() as Record<string, unknown>) : null;
          },
          async set(path, data) {
            t.set(db.doc(path), data);
          },
        }),
      );
    },
  };
  // Created lazily so importing this module needs no credentials.
  let client: KeyManagementServiceClient | undefined;
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
  const lazy = (): Deps["kms"] => kmsCrypto((client ??= new KeyManagementServiceClient()), KMS_KEY(project));
  const kms: Deps["kms"] = {
    encrypt: (plain, aad) => lazy().encrypt(plain, aad),
    decrypt: (cipher, aad) => lazy().decrypt(cipher, aad),
  };
  return { store, kms, fetch, now: Date.now };
}
