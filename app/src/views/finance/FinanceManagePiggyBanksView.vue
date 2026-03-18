<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { usePiggyBanks, type PiggyBank } from "../../composables/usePiggyBanks";

const router = useRouter();

const { piggyBanks, addPiggyBank, updatePiggyBank, removePiggyBank } = usePiggyBanks();

const newName = ref("");
const newPercentage = ref<number | "">("");
const addError = ref("");

const editingId = ref<string | null>(null);
const editingName = ref("");
const editingPercentage = ref<number>(0);

function parsePercentage(value: string): number {
	const n = parseFloat(value.replace(/[,\s%]/g, ""));
	return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

async function startAdd() {
	addError.value = "";
	const name = newName.value.trim();
	const pct = newPercentage.value === "" ? 0 : parsePercentage(String(newPercentage.value));
	if (!name) {
		addError.value = "Enter a name.";
		return;
	}
	if (pct <= 0 || pct > 100) {
		addError.value = "Enter a percentage between 1 and 100.";
		return;
	}
	try {
		await addPiggyBank(name, pct);
		newName.value = "";
		newPercentage.value = "";
	} catch (e) {
		addError.value = e instanceof Error ? e.message : "Failed to add.";
	}
}

function startEdit(pb: PiggyBank) {
	editingId.value = pb.id;
	editingName.value = pb.name;
	editingPercentage.value = pb.percentage;
}

function cancelEdit() {
	editingId.value = null;
	editingName.value = "";
	editingPercentage.value = 0;
}

async function saveEdit() {
	if (editingId.value === null) return;
	const pct = Math.max(0, Math.min(100, editingPercentage.value));
	try {
		await updatePiggyBank(editingId.value, editingName.value, pct);
		cancelEdit();
	} catch (_) {}
}

async function removePb(id: string) {
	try {
		await removePiggyBank(id);
	} catch (_) {}
}

function onNewPctInput(event: Event) {
	const el = event.target as HTMLInputElement;
	newPercentage.value = el.value === "" ? "" : parsePercentage(el.value);
}

function onEditPctInput(event: Event) {
	const el = event.target as HTMLInputElement;
	editingPercentage.value = parsePercentage(el.value);
}
</script>

<template>
	<div class="cider cider-fixed max-w-2xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
		</nav>
		<h1>Manage piggy banks</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Create piggy banks and set what percentage of your net income (after subscriptions) goes to each. View growth on each piggy bank’s page.
		</p>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Add piggy bank
			</h2>
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-0">
					<label for="pb-name" class="block text-[13px] text-tertiary-foreground mb-1">Name</label>
					<input
						id="pb-name"
						v-model="newName"
						type="text"
						class="w-48"
						placeholder="e.g. Vacation fund"
						@keydown.enter.prevent="startAdd" />
				</div>
				<div class="min-w-0">
					<label for="pb-pct" class="block text-[13px] text-tertiary-foreground mb-1">% of net income</label>
					<input
						id="pb-pct"
						:value="newPercentage === '' ? '' : newPercentage"
						type="text"
						inputmode="decimal"
						class="w-24 text-right"
						placeholder="10"
						@input="onNewPctInput"
						@keydown.enter.prevent="startAdd" />
				</div>
				<span class="text-tertiary-foreground text-[15px] pb-2">%</span>
				<button
					type="button"
					class="btn-filled btn-small"
					:disabled="!newName.trim() || newPercentage === '' || parsePercentage(String(newPercentage)) <= 0 || parsePercentage(String(newPercentage)) > 100"
					@click="startAdd">
					Add
				</button>
			</div>
			<p v-if="addError" class="text-destructive text-[14px] mt-2">{{ addError }}</p>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Your piggy banks
			</h2>
			<p v-if="piggyBanks.length === 0" class="text-[15px] text-tertiary-foreground">
				No piggy banks yet. Add one above.
			</p>
			<div
				v-else
				class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="pb in piggyBanks"
					:key="pb.id"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<template v-if="editingId === pb.id">
						<input
							v-model="editingName"
							type="text"
							class="min-w-0 flex-1 max-w-48"
							@keydown.enter="saveEdit"
							@keydown.escape="cancelEdit" />
						<input
							:value="editingPercentage"
							type="text"
							inputmode="decimal"
							class="w-20 text-right"
							@input="onEditPctInput"
							@keydown.enter="saveEdit"
							@keydown.escape="cancelEdit" />
						<span class="text-tertiary-foreground">%</span>
						<div class="flex gap-2 shrink-0">
							<button type="button" class="btn-filled btn-small" @click="saveEdit">Save</button>
							<button type="button" class="btn-gray btn-small" @click="cancelEdit">Cancel</button>
						</div>
					</template>
					<template v-else>
						<router-link
							:to="{ name: 'finance-piggy-bank-detail', params: { id: pb.id } }"
							class="min-w-40 text-[15px] font-medium no-underline text-inherit hover:underline">
							{{ pb.name }}
						</router-link>
						<span class="text-[15px] text-tertiary-foreground">{{ pb.percentage }}%</span>
						<div class="flex gap-2 ml-auto">
							<router-link
								:to="{ name: 'finance-piggy-bank-detail', params: { id: pb.id } }"
								class="btn-plain btn-small">
								View growth
							</router-link>
							<button type="button" class="btn-plain btn-small" @click="startEdit(pb)">Edit</button>
							<button type="button" class="btn-plain btn-small btn-destructive" @click="() => removePb(pb.id)">Remove</button>
						</div>
					</template>
				</div>
			</div>
		</section>
	</div>
</template>

<style scoped>
.list-group-row:hover {
	background: var(--color-panel-hover, var(--color-panel));
}
</style>
