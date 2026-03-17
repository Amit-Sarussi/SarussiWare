<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth, getTrpcErrorMessage } from "../composables/useAuth";
import { trpc } from "../trpc";
import logoSvg from "../assets/sarussiware.svg";

const router = useRouter();
const { setUser } = useAuth();
const name = ref("");
const password = ref("");
const rememberMe = ref(false);
const error = ref("");
const loading = ref(false);

const canSubmit = computed(
	() => name.value.trim() && password.value && !loading.value,
);

async function submit() {
	if (!canSubmit.value) return;
	error.value = "";
	loading.value = true;
	try {
		const data = await trpc.auth.login.mutate({
			name: name.value.trim(),
			password: password.value,
			rememberMe: rememberMe.value,
		});
		setUser(data.user ?? null);
		router.push({ path: "/" });
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div
		class="cider flex justify-center items-center flex-col h-screen w-screen gap-4">
		<img :src="logoSvg" alt="SarussiWare" class="w-24" />
		<form @submit.prevent="submit" class="auth-form w-72">
			<label for="login-name">Name</label>
			<input
				id="login-name"
				v-model="name"
				type="text"
				autocomplete="username"
				required
				:aria-invalid="!!error" />
			<label for="login-password">Password</label>
			<input
				id="login-password"
				v-model="password"
				type="password"
				autocomplete="current-password"
				required
				:aria-invalid="!!error" />
			<label class="remember-me">
				<input
					v-model="rememberMe"
					type="checkbox"
					role="switch"
					aria-label="Remember me" />
				<span>Remember me</span>
			</label>
			<div v-if="error" class="callout callout-error mt-4" role="alert">
				<p>{{ error }}</p>
			</div>
			<button
				type="submit"
				class="btn-filled w-full mt-6"
				:disabled="!canSubmit"
				:aria-busy="loading">
				{{ loading ? "Signing in…" : "Log in" }}
			</button>
		</form>
	</div>
</template>

<style scoped>
.auth-form .remember-me {
	margin-top: 1rem;
}
</style>
