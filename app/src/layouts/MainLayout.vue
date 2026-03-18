<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

declare global {
	interface Window {
		openActionSheet?: (dialog: HTMLDialogElement) => void;
	}
}

const router = useRouter();
const { user, logout } = useAuth();
const isAdmin = computed(() => user.value?.permissions?.includes("admin") ?? false);
const logoutSheetRef = ref<HTMLDialogElement | null>(null);

function openLogoutSheet() {
	const el = logoutSheetRef.value;
	if (el && typeof window.openActionSheet === "function") {
		window.openActionSheet(el);
	}
}

function closeLogoutSheet() {
	logoutSheetRef.value?.close();
}

async function handleLogout() {
	await logout();
	closeLogoutSheet();
	router.push("/login");
}
</script>

<template>
	<div class="cider main-layout">
		<aside class="sidebar-wrapper">
			<nav class="sidebar" data-tinted aria-label="Main navigation">
				<div>
					<h2>Main</h2>
					<router-link
						to="/"
						:aria-current="$route.path === '/' ? 'page' : undefined">
						Home
					</router-link>
				</div>
				<div>
					<h2>Finance control</h2>
					<router-link
						to="/finance/overview"
						:aria-current="
							$route.path === '/finance/overview' ? 'page' : undefined
						">
						Overview
					</router-link>
					<router-link
						to="/finance/manage"
						:aria-current="
							$route.path === '/finance/manage' ? 'page' : undefined
						">
						Manage
					</router-link>
				</div>
				<div v-if="isAdmin">
					<h2>Administrator</h2>
					<router-link
						to="/system-settings"
						:aria-current="
							$route.path === '/system-settings' ? 'page' : undefined
						">
						System settings
					</router-link>
				</div>
				<div>
					<h2>Account</h2>
					<router-link
						to="/account-settings"
						:aria-current="
							$route.path === '/account-settings' ? 'page' : undefined
						">
						Account settings
					</router-link>
					<button type="button" @click="openLogoutSheet">
						Log out ({{ user?.name }})
					</button>
				</div>
			</nav>
		</aside>

		<dialog
			ref="logoutSheetRef"
			class="action-sheet"
			aria-labelledby="logout-sheet-title"
			aria-describedby="logout-sheet-desc">
			<div class="action-sheet-group">
				<div class="action-sheet-header">
					<p id="logout-sheet-title" class="action-sheet-title">Log out?</p>
					<p id="logout-sheet-desc" class="action-sheet-message">
						You will need to sign in again to access your account.
					</p>
				</div>
				<button
					type="button"
					class="action-sheet-destructive"
					@click="handleLogout">
					Log out
				</button>
			</div>
			<div class="action-sheet-group">
				<button type="button" class="action-sheet-cancel" @click="closeLogoutSheet">
					Cancel
				</button>
			</div>
		</dialog>
		<main class="main-content">
			<router-view />
		</main>
	</div>
</template>

<style scoped>
.main-layout {
	display: flex;
	min-height: 100vh;
}

.sidebar-wrapper {
	flex-shrink: 0;
	width: 220px;
	border-right: 1px solid var(--color-border);
	background: var(--color-secondary);
}

.sidebar {
	position: sticky;
	top: 0;
	max-height: 100vh;
	padding-top: 1rem;
}

.main-content {
	flex: 1;
	min-width: 0;
	padding: 1.5rem 2rem;
}
</style>
