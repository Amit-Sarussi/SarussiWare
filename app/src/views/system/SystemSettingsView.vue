<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { trpc } from "../../trpc";
import { getTrpcErrorMessage, useAuth } from "../../composables/useAuth";

const { user: currentUser } = useAuth();

interface UserRow {
	id: number;
	name: string;
	permissionIds: number[];
	permissions: string[];
	createdAt: string;
}

interface PermissionRow {
	id: number;
	name: string;
	userIds: number[];
}

const users = ref<UserRow[]>([]);
const permissions = ref<PermissionRow[]>([]);
const loading = ref(true);
const error = ref("");

const newName = ref("");
const newPassword = ref("");
const newUserPermissionIds = ref<number[]>([]);
const addError = ref("");
const addLoading = ref(false);

const editingId = ref<number | null>(null);
const editingName = ref("");
const editError = ref("");
const editLoading = ref(false);

const selectedPermissionIdByUser = ref<Record<number, number>>({});

const newPermissionName = ref("");
const addPermissionError = ref("");
const addPermissionLoading = ref(false);

const addUserDialogRef = ref<HTMLDialogElement | null>(null);

const resetPasswordUserId = ref<number | null>(null);
const resetPasswordValue = ref("");
const resetPasswordLoading = ref(false);
const resetPasswordError = ref("");
const resetPasswordDialogRef = ref<HTMLDialogElement | null>(null);

const permissionOptions = computed(() =>
	permissions.value.map((p) => ({ value: p.id, label: `${p.name} (${p.id})` }))
);

function openAddUserDialog() {
	const el = addUserDialogRef.value;
	if (el && typeof (window as unknown as { openDialog?: (d: HTMLDialogElement) => void }).openDialog === "function") {
		(window as unknown as { openDialog: (d: HTMLDialogElement) => void }).openDialog(el);
	}
}

function closeAddUserDialog() {
	const el = addUserDialogRef.value;
	if (el && typeof (window as unknown as { closeDialog?: (d: HTMLDialogElement) => void }).closeDialog === "function") {
		(window as unknown as { closeDialog: (d: HTMLDialogElement) => void }).closeDialog(el);
	}
	newName.value = "";
	newPassword.value = "";
	newUserPermissionIds.value = [];
	addError.value = "";
}

async function loadUsers() {
	try {
		users.value = await trpc.users.list.query();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

async function loadPermissions() {
	try {
		permissions.value = await trpc.permissions.list.query();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

async function load() {
	loading.value = true;
	error.value = "";
	try {
		await Promise.all([loadUsers(), loadPermissions()]);
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	} finally {
		loading.value = false;
	}
}

onMounted(load);

async function addUser() {
	if (!newName.value.trim() || !newPassword.value) return;
	addLoading.value = true;
	addError.value = "";
	try {
		await trpc.users.create.mutate({
			name: newName.value.trim(),
			password: newPassword.value,
			permissionIds: newUserPermissionIds.value.length ? newUserPermissionIds.value : undefined,
		});
		closeAddUserDialog();
		await load();
	} catch (e) {
		addError.value = getTrpcErrorMessage(e);
	} finally {
		addLoading.value = false;
	}
}

function startEdit(user: UserRow) {
	editingId.value = user.id;
	editingName.value = user.name;
	editError.value = "";
}

function cancelEdit() {
	editingId.value = null;
	editingName.value = "";
	editError.value = "";
}

async function saveEdit() {
	if (editingId.value === null) return;
	editLoading.value = true;
	editError.value = "";
	try {
		await trpc.users.update.mutate({
			id: editingId.value,
			name: editingName.value.trim(),
		});
		cancelEdit();
		await load();
	} catch (e) {
		editError.value = getTrpcErrorMessage(e);
	} finally {
		editLoading.value = false;
	}
}

async function deleteUser(user: UserRow) {
	if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
	try {
		await trpc.users.delete.mutate({ id: user.id });
		await load();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

function permissionNameById(permissionId: number): string {
	return permissions.value.find((p) => p.id === permissionId)?.name ?? String(permissionId);
}

async function addPermissionToUser(userId: number) {
	const raw = selectedPermissionByUser(userId);
	if (raw == null || raw === "") return;
	const permissionId = Number(raw);
	if (Number.isNaN(permissionId)) return;
	try {
		await trpc.users.addPermission.mutate({ userId, permissionId });
		const next = { ...selectedPermissionIdByUser.value };
		delete next[userId];
		selectedPermissionIdByUser.value = next;
		await load();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

function selectedPermissionByUser(userId: number): number | string | undefined {
	const id = selectedPermissionIdByUser.value[userId];
	return id !== undefined && id !== null ? id : undefined;
}

async function removePermissionFromUser(userId: number, permissionId: number) {
	try {
		await trpc.users.removePermission.mutate({ userId, permissionId });
		await load();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

async function addPermission() {
	const name = newPermissionName.value.trim();
	if (!name) return;
	addPermissionLoading.value = true;
	addPermissionError.value = "";
	try {
		await trpc.permissions.create.mutate({ name });
		newPermissionName.value = "";
		await loadPermissions();
	} catch (e) {
		addPermissionError.value = getTrpcErrorMessage(e);
	} finally {
		addPermissionLoading.value = false;
	}
}

async function deletePermission(perm: PermissionRow) {
	if (!confirm(`Remove permission "${perm.name}"? It will be removed from all users.`)) return;
	try {
		await trpc.permissions.delete.mutate({ id: perm.id });
		await load();
	} catch (e) {
		error.value = getTrpcErrorMessage(e);
	}
}

function isCurrentUser(userId: number): boolean {
	return currentUser.value?.id === userId;
}

function openResetPasswordDialog(userRow: UserRow) {
	resetPasswordUserId.value = userRow.id;
	resetPasswordValue.value = "";
	resetPasswordError.value = "";
	const el = resetPasswordDialogRef.value;
	if (el && typeof (window as unknown as { openDialog?: (d: HTMLDialogElement) => void }).openDialog === "function") {
		(window as unknown as { openDialog: (d: HTMLDialogElement) => void }).openDialog(el);
	}
}

function closeResetPasswordDialog() {
	const el = resetPasswordDialogRef.value;
	if (el && typeof (window as unknown as { closeDialog?: (d: HTMLDialogElement) => void }).closeDialog === "function") {
		(window as unknown as { closeDialog: (d: HTMLDialogElement) => void }).closeDialog(el);
	}
	resetPasswordUserId.value = null;
	resetPasswordValue.value = "";
	resetPasswordError.value = "";
}

const resetPasswordUserName = computed(() => {
	if (resetPasswordUserId.value == null) return "";
	return users.value.find((u) => u.id === resetPasswordUserId.value)?.name ?? "";
});

async function submitResetPassword() {
	if (resetPasswordUserId.value == null || !resetPasswordValue.value || resetPasswordValue.value.length < 8) return;
	resetPasswordLoading.value = true;
	resetPasswordError.value = "";
	try {
		await trpc.users.update.mutate({
			id: resetPasswordUserId.value,
			password: resetPasswordValue.value,
		});
		closeResetPasswordDialog();
		await loadUsers();
	} catch (e) {
		resetPasswordError.value = getTrpcErrorMessage(e);
	} finally {
		resetPasswordLoading.value = false;
	}
}
</script>

<template>
	<div class="cider cider-fixed max-w-4xl">
		<h1>System settings</h1>

		<section class="mt-8">
			<h2 class="mb-1">Users</h2>
			<p v-if="loading" class="text-tertiary-foreground text-[15px]">Loading…</p>
			<div v-else-if="error" class="callout mt-3" role="alert">
				<p class="text-destructive">{{ error }}</p>
			</div>
			<div v-else class="grid gap-4 mt-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
				<button type="button" class="card flex flex-col items-center justify-center min-h-30 gap-2 text-tertiary-foreground" @click="openAddUserDialog">
					<span class="text-2xl leading-none" aria-hidden="true">+</span>
					<span class="text-[15px]">Add user</span>
				</button>
				<div
					v-for="user in users"
					:key="user.id"
					class="card flex flex-col">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<template v-if="editingId === user.id">
							<input
								v-model="editingName"
								type="text"
								class="min-w-0 flex-1"
								@keydown.enter="saveEdit"
								@keydown.escape="cancelEdit" />
							<div class="flex gap-2">
								<button type="button" class="btn-filled btn-small" :disabled="editLoading" @click="saveEdit">Save</button>
								<button type="button" class="btn-gray btn-small" @click="cancelEdit">Cancel</button>
							</div>
						</template>
						<template v-else>
							<span class="font-semibold text-[17px]">{{ user.name }}</span>
							<div class="flex gap-2">
								<button
									v-if="!isCurrentUser(user.id)"
									type="button"
									class="btn-plain btn-small"
									@click="startEdit(user)">
									Edit
								</button>
								<button
									v-if="!isCurrentUser(user.id)"
									type="button"
									class="btn-plain btn-small btn-destructive"
									@click="deleteUser(user)">
									Delete
								</button>
								<button type="button" class="btn-plain btn-small" @click="openResetPasswordDialog(user)">
									Reset password
								</button>
							</div>
						</template>
					</div>
					<div v-if="editingId === user.id && editError" class="callout mt-3" role="alert">
						<p class="text-destructive">{{ editError }}</p>
					</div>
					<div class="pt-4 mt-4 border-t border-(--panel-border)">
						<small class="block mb-2 text-tertiary-foreground">Permissions</small>
						<div class="flex flex-wrap items-center gap-2 min-h-6">
							<template v-for="pid in user.permissionIds" :key="pid">
								<span class="inline-flex items-center gap-1 rounded-xs bg-secondary px-2 py-0.5 text-[13px]">
									{{ permissionNameById(pid) }}
									<button
										type="button"
										class="tag-remove"
										aria-label="Remove permission"
										@click="removePermissionFromUser(user.id, pid)">
										×
									</button>
								</span>
							</template>
							<span v-if="user.permissionIds.length === 0" class="text-[13px] text-tertiary-foreground">None</span>
						</div>
						<div class="flex gap-2 items-center mt-3">
							<select
								v-model="selectedPermissionIdByUser[user.id]"
								class="min-w-0 max-w-48 flex-1"
								:aria-label="`Add permission for ${user.name}`">
								<option :value="undefined" disabled>Select permission</option>
								<option
									v-for="opt in permissionOptions.filter((o) => !user.permissionIds.includes(o.value))"
									:key="opt.value"
									:value="opt.value">
									{{ opt.label }}
								</option>
							</select>
							<button
								type="button"
								class="btn-gray btn-small shrink-0"
								:disabled="selectedPermissionByUser(user.id) == null"
								@click="addPermissionToUser(user.id)">
								Add
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<dialog
			ref="addUserDialogRef"
			class="dialog"
			aria-labelledby="add-user-dialog-title"
			aria-describedby="add-user-dialog-desc">
			<button type="button" class="dialog-close" aria-label="Close" @click="closeAddUserDialog">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6 6 18" /><path d="m6 6 12 12" />
				</svg>
			</button>
			<header>
				<h2 id="add-user-dialog-title">Add user</h2>
				<p id="add-user-dialog-desc">Create a new user account. They can sign in with name and password.</p>
			</header>
			<section>
				<form id="add-user-form" @submit.prevent="addUser">
					<label for="add-user-name">Name</label>
					<input
						id="add-user-name"
						v-model="newName"
						type="text"
						autocomplete="username"
						required
						placeholder="Display name" />
					<label for="add-user-password">Password</label>
					<input
						id="add-user-password"
						v-model="newPassword"
						type="password"
						autocomplete="new-password"
						required
						minlength="8"
						placeholder="At least 8 characters" />
					<div v-if="permissions.length" class="mt-4">
						<small class="block mb-2 text-tertiary-foreground">Roles</small>
						<div class="flex flex-wrap gap-x-5 gap-y-2">
							<label
								v-for="perm in permissions"
								:key="perm.id"
								class="inline-flex items-center gap-2 cursor-pointer text-[15px]">
								<input
									v-model="newUserPermissionIds"
									type="checkbox"
									:value="perm.id" />
								<span>{{ perm.name }}</span>
							</label>
						</div>
					</div>
					<div v-if="addError" class="callout mt-2" role="alert">
						<p class="text-destructive">{{ addError }}</p>
					</div>
				</form>
			</section>
			<footer>
				<button type="button" class="btn-gray" @click="closeAddUserDialog">Cancel</button>
				<button type="submit" class="btn-filled" form="add-user-form" :disabled="addLoading">
					{{ addLoading ? "Adding…" : "Add user" }}
				</button>
			</footer>
		</dialog>

		<dialog
			ref="resetPasswordDialogRef"
			class="dialog"
			aria-labelledby="reset-password-dialog-title"
			aria-describedby="reset-password-dialog-desc">
			<button type="button" class="dialog-close" aria-label="Close" @click="closeResetPasswordDialog">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6 6 18" /><path d="m6 6 12 12" />
				</svg>
			</button>
			<header>
				<h2 id="reset-password-dialog-title">Reset password</h2>
				<p id="reset-password-dialog-desc">Set a new password for {{ resetPasswordUserName }}.</p>
			</header>
			<section>
				<form id="reset-password-form" @submit.prevent="submitResetPassword">
					<label for="reset-password-new">New password</label>
					<input
						id="reset-password-new"
						v-model="resetPasswordValue"
						type="password"
						autocomplete="new-password"
						required
						minlength="8"
						placeholder="At least 8 characters" />
					<div v-if="resetPasswordError" class="callout mt-2" role="alert">
						<p class="text-destructive">{{ resetPasswordError }}</p>
					</div>
				</form>
			</section>
			<footer>
				<button type="button" class="btn-gray" @click="closeResetPasswordDialog">Cancel</button>
				<button
					type="submit"
					class="btn-filled"
					form="reset-password-form"
					:disabled="resetPasswordLoading || resetPasswordValue.length < 8">
					{{ resetPasswordLoading ? "Saving…" : "Reset password" }}
				</button>
			</footer>
		</dialog>

		<section class="mt-8">
			<h2 class="mb-1">Permissions</h2>
			<small class="block mb-3 text-tertiary-foreground">Manage permission types. Assign them to users in the user cards above.</small>
			<div class="flex flex-wrap gap-2 items-center">
				<input
					v-model="newPermissionName"
					type="text"
					class="w-48"
					placeholder="New permission name"
					@keydown.enter.prevent="addPermission" />
				<button type="button" class="btn-filled btn-small" :disabled="addPermissionLoading || !newPermissionName.trim()" @click="addPermission">
					{{ addPermissionLoading ? "Adding…" : "Add permission" }}
				</button>
			</div>
			<div v-if="addPermissionError" class="callout mt-3" role="alert">
				<p class="text-destructive">{{ addPermissionError }}</p>
			</div>
			<div class="flex flex-wrap gap-3 mt-4">
				<div
					v-for="perm in permissions"
					:key="perm.id"
					class="card flex flex-row flex-wrap items-center gap-3">
					<span class="font-medium">{{ perm.name }}</span>
					<small class="text-tertiary-foreground">ID: {{ perm.id }}</small>
					<button type="button" class="btn-plain btn-small btn-destructive" @click="deletePermission(perm)">Remove</button>
				</div>
				<p v-if="permissions.length === 0 && !loading" class="text-[13px] text-tertiary-foreground">No permissions yet. Add one above.</p>
			</div>
		</section>
	</div>
</template>

<style scoped>
.tag-remove {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	margin: 0;
	border: none;
	background: none;
	cursor: pointer;
	color: var(--color-tertiary-foreground);
	font-size: 1rem;
	line-height: 1;
	border-radius: 2px;
}
.tag-remove:hover {
	color: var(--color-destructive);
}
</style>
