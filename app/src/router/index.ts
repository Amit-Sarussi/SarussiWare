import { createRouter, createWebHistory } from "vue-router";
import { useAuth, authGuardPending } from "../composables/useAuth";
import MainLayout from "../layouts/MainLayout.vue";
import WelcomeView from "../views/WelcomeView.vue";
import SettingsView from "../views/SettingsView.vue";
import AccountSettingsView from "../views/AccountSettingsView.vue";
import LoginView from "../views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", name: "home", component: WelcomeView },
        { path: "system-settings", name: "system-settings", component: SettingsView },
        { path: "account-settings", name: "account-settings", component: AccountSettingsView },
      ],
    },
    { path: "/login", name: "login", component: LoginView },
  ],
});

router.beforeEach(async (to) => {
  const { fetchMe, isLoggedIn, loaded } = useAuth();

  if (loaded.value) {
    // Already have auth state — resolve immediately, no loading
    if (to.path === "/login") {
      if (isLoggedIn.value) return { path: "/" };
      return true;
    }
    if (!isLoggedIn.value) return { path: "/login" };
    return true;
  }

  // First load: fetch user and show loading until we know
  authGuardPending.value = true;
  try {
    await fetchMe();
    if (to.path === "/login") {
      if (isLoggedIn.value) return { path: "/" };
      return true;
    }
    if (!isLoggedIn.value) return { path: "/login" };
    return true;
  } finally {
    authGuardPending.value = false;
  }
});

export default router;
