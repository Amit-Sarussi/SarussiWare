<script setup lang="ts">
import { ref, onMounted } from "vue";
import HelloWorld from "./components/HelloWorld.vue";

export interface User {
	id: number;
	name: string;
	createdAt: string;
}

const users = ref<User[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const newName = ref("");
const adding = ref(false);

async function fetchUsers() {
	loading.value = true;
	error.value = null;
	try {
		const res = await fetch("/api/users");
		if (!res.ok) throw new Error(await res.text());
		const data = await res.json();
		users.value = data.users ?? [];
	} catch (e) {
		error.value = e instanceof Error ? e.message : "Failed to load users";
	} finally {
		loading.value = false;
	}
}

async function addUser() {
	const name = newName.value.trim();
	if (!name || adding.value) return;
	adding.value = true;
	error.value = null;
	try {
		const res = await fetch("/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) throw new Error(await res.text());
		newName.value = "";
		await fetchUsers();
	} catch (e) {
		error.value = e instanceof Error ? e.message : "Failed to add user";
	} finally {
		adding.value = false;
	}
}

onMounted(fetchUsers);
</script>

<template>
	<HelloWorld />

	<section class="db-section">
		<h2>Database (Prisma + PostgreSQL) Hello</h2>
		<p v-if="error" class="error">{{ error }}</p>
		<div v-else-if="loading">Loading users…</div>
		<template v-else>
			<ul class="user-list">
				<li v-for="u in users" :key="u.id">
					{{ u.name }} <small>(id: {{ u.id }})</small>
				</li>
			</ul>
			<form @submit.prevent="addUser" class="add-user">
				<input v-model="newName" placeholder="New user name" type="text" />
				<button type="submit" :disabled="adding || !newName.trim()">Add</button>
			</form>
		</template>
	</section>
</template>

<style scoped>
.db-section {
	margin: 2rem;
	padding: 1rem;
	border: 1px solid #ddd;
	border-radius: 8px;
}
.db-section h2 {
	margin-top: 0;
}
.error {
	color: #c00;
}
.user-list {
	list-style: none;
	padding-left: 0;
}
.add-user {
	margin-top: 1rem;
	display: flex;
	gap: 0.5rem;
}
.add-user input {
	flex: 1;
	padding: 0.25rem 0.5rem;
}
</style>
