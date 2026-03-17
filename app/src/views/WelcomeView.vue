<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { user, isLoggedIn, loaded, fetchMe, logout } = useAuth();

onMounted(fetchMe);

function goLogin() {
	router.push({ name: "login" });
}
</script>

<template>
	<div class="welcome">
		<template v-if="!loaded">Loading…</template>
		<template v-else-if="isLoggedIn && user">
			<h1>Hello, {{ user.name }}</h1>
			<p>You are logged in as {{ user.name }}.</p>
			<div class="actions">
				<button @click="logout">Log out</button>
			</div>
		</template>
		<template v-else>
			<h1>Welcome</h1>
			<p>Sign in to continue.</p>
			<div class="actions">
				<button @click="goLogin">Log in</button>
			</div>
		</template>
	</div>
</template>

<style scoped>
.welcome {
	max-width: 360px;
	margin: 4rem auto;
	padding: 2rem;
	text-align: center;
}
.welcome h1 {
	margin-top: 0;
}
.actions {
	display: flex;
	gap: 1rem;
	justify-content: center;
	margin-top: 1.5rem;
}
</style>
