import { describe, expect, it, vi } from "vitest";
import { FirebaseError } from "firebase/app";
import { queryClient } from "./queryClient";
import { onWriteDenied } from "./writeDenied";

async function run(err: Error) {
  await queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: () => Promise.reject(err) })
    .execute(undefined)
    .catch(() => undefined);
}

describe("queryClient mutation errors", () => {
  it("notifies on permission-denied", async () => {
    const cb = vi.fn();
    const off = onWriteDenied(cb);
    await run(new FirebaseError("permission-denied", "x"));
    off();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores other errors", async () => {
    const cb = vi.fn();
    const off = onWriteDenied(cb);
    await run(new FirebaseError("unavailable", "x"));
    await run(new Error("boom"));
    off();
    expect(cb).not.toHaveBeenCalled();
  });
});
