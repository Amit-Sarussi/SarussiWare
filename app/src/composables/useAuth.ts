import { ref, computed } from "vue";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "../trpc";

export interface User {
  id: number;
  name: string;
  permissions: string[];
  createdAt: string;
}

const user = ref<User | null>(null);
const loaded = ref(false);

/** True while the router guard is awaiting fetchMe(); use in App.vue to show loading instead of blank. */
export const authGuardPending = ref(false);

/** Call when the server returns UNAUTHORIZED (e.g. token expired) to clear client state. */
export function clearUser(): void {
  user.value = null;
}

export function useAuth() {
  const isLoggedIn = computed(() => user.value !== null);

  async function fetchMe() {
    loaded.value = false;
    try {
      const data = await trpc.auth.me.query();
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      loaded.value = true;
    }
  }

  async function logout() {
    try {
      await trpc.auth.logout.mutate();
    } finally {
      user.value = null;
    }
  }

  function setUser(u: User | null) {
    user.value = u;
  }

  return {
    user: computed(() => user.value),
    isLoggedIn,
    loaded: computed(() => loaded.value),
    fetchMe,
    logout,
    setUser,
  };
}

export function getTrpcErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong";
}
