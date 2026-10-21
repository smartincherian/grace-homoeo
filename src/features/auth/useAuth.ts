import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";

export function useAuth(): { user: User | null; loading: boolean } {
  // Start from the current user so a newly mounted component (e.g. OwnerOnly)
  // doesn't see a signed-out first render and redirect.
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(() => !auth.currentUser);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );
  return { user, loading };
}
