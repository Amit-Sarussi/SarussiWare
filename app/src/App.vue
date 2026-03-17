<script setup lang="ts">
import { authGuardPending } from "./composables/useAuth";
</script>

<template>
  <div id="app">
    <div v-if="authGuardPending" class="auth-loading">
      Loading…
    </div>
    <router-view v-else />
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
}

.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1rem;
  color: var(--color-foreground, #1a1a1a);
}
</style>
