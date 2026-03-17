import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { clearUser } from "./composables/useAuth";
import "ciderui/action-sheet.js";
import "ciderui/dialog.js";
import "./globals.css";

createApp(App).use(router).mount("#app");

// When any tRPC call returns UNAUTHORIZED, clear auth. Redirect to login only if it wasn't auth.me (avoids loop).
if (typeof window !== "undefined") {
  window.__onTrpcUnauthorized = (path) => {
    clearUser();
    if (path !== "auth.me") {
      router.push("/login");
    }
  };
}
