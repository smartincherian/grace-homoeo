import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../../lib/firebase";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: "admin",
  });
}
