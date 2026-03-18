<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useDebts, type Debt } from "../../composables/useDebts";
import { formatShekels } from "../../composables/useCurrency";

const router = useRouter();

const { debts, addDebt, updateDebt, removeDebt, getPaidToDebt } = useDebts();

/** Unfinished first, then finished (paid >= totalAmount) */
const debtsOrdered = computed(() => {
	const list = debts.value.map((d) => ({
		...d,
		remaining: Math.max(0, d.totalAmount - getPaidToDebt(d.id)),
	}));
	const unfinished = list.filter((d) => d.remaining > 0);
	const finished = list.filter((d) => d.remaining <= 0);
	return [...unfinished, ...finished];
});

const newName = ref("");
const newAmount = ref<number | "">("");
const addError = ref("");

const editingId = ref<string | null>(null);
const editingName = ref("");
const editingAmount = ref<number>(0);

function parseAmount(value: string): number {
	const n = parseFloat(value.replace(/[,\s₪]/g, ""));
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function startAdd() {
	addError.value = "";
	const name = newName.value.trim();
	const amount = newAmount.value === "" ? 0 : parseAmount(String(newAmount.value));
	if (!name) {
		addError.value = "Enter a name.";
		return;
	}
	if (amount <= 0) {
		addError.value = "Enter an amount greater than 0.";
		return;
	}
	try {
		await addDebt(name, amount);
		newName.value = "";
		newAmount.value = "";
	} catch (e) {
		addError.value = e instanceof Error ? e.message : "Failed to add debt.";
	}
}

function startEdit(d: Debt) {
	editingId.value = d.id;
	editingName.value = d.name;
	editingAmount.value = d.totalAmount;
}

function cancelEdit() {
	editingId.value = null;
	editingName.value = "";
	editingAmount.value = 0;
}

async function saveEdit() {
	if (editingId.value === null) return;
	const amount = Math.max(0, editingAmount.value);
	try {
		await updateDebt(editingId.value, { name: editingName.value, totalAmount: amount });
		cancelEdit();
	} catch (_) {}
}

async function removeDebtById(id: string) {
	try {
		await removeDebt(id);
	} catch (_) {}
}

function onNewAmountInput(event: Event) {
	const el = event.target as HTMLInputElement;
	newAmount.value = el.value === "" ? "" : parseAmount(el.value);
}

function onEditAmountInput(event: Event) {
	const el = event.target as HTMLInputElement;
	editingAmount.value = parseAmount(el.value);
}
</script>

<template>
	<div class="cider cider-fixed max-w-2xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
		</nav>
		<h1>Manage debts</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Add debts with a name and total amount. Record payments by adding a transfer to the debt from the overview or transactions.
		</p>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Add debt
			</h2>
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-0">
					<label for="debt-name" class="block text-[13px] text-tertiary-foreground mb-1">Name</label>
					<input
						id="debt-name"
						v-model="newName"
						type="text"
						class="w-48"
						placeholder="e.g. Bank loan"
						@keydown.enter.prevent="startAdd" />
				</div>
				<div class="min-w-0">
					<label for="debt-amount" class="block text-[13px] text-tertiary-foreground mb-1">Total amount (₪)</label>
					<input
						id="debt-amount"
						:value="newAmount === '' ? '' : newAmount"
						type="text"
						inputmode="decimal"
						class="w-28 text-right"
						placeholder="0"
						@input="onNewAmountInput"
						@keydown.enter.prevent="startAdd" />
				</div>
				<button
					type="button"
					class="btn-filled btn-small"
					:disabled="!newName.trim() || newAmount === '' || parseAmount(String(newAmount)) <= 0"
					@click="startAdd">
					Add
				</button>
			</div>
			<p v-if="addError" class="text-destructive text-[14px] mt-2">{{ addError }}</p>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Your debts
			</h2>
			<p v-if="debts.length === 0" class="text-[15px] text-tertiary-foreground">
				No debts yet. Add one above.
			</p>
			<div
				v-else
				class="list-group rounded-lg overflow-visible border border-(--panel-border)">
				<div
					v-for="d in debtsOrdered"
					:key="d.id"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0 relative overflow-visible"
					:class="{ 'opacity-50 text-tertiary-foreground': d.remaining <= 0 }">
					<div
						v-if="d.remaining <= 0"
						class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
						aria-hidden="true">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="w-12 h-12 text-emerald-600 dark:text-emerald-400">
							<path d="M20 6L9 17l-5-5" />
						</svg>
					</div>
					<template v-if="editingId === d.id">
						<input
							v-model="editingName"
							type="text"
							class="min-w-0 flex-1 max-w-48"
							@keydown.enter="saveEdit"
							@keydown.escape="cancelEdit" />
						<span class="text-tertiary-foreground shrink-0" aria-hidden="true">₪</span>
						<input
							:value="editingAmount"
							type="text"
							inputmode="decimal"
							class="w-24 text-right"
							@input="onEditAmountInput"
							@keydown.enter="saveEdit"
							@keydown.escape="cancelEdit" />
						<div class="flex gap-2 shrink-0">
							<button type="button" class="btn-filled btn-small" @click="saveEdit">Save</button>
							<button type="button" class="btn-gray btn-small" @click="cancelEdit">Cancel</button>
						</div>
					</template>
					<template v-else>
						<span class="min-w-40 text-[15px] font-medium">{{ d.name }}</span>
						<span class="text-[15px] tabular-nums">{{ formatShekels(d.totalAmount) }} total</span>
						<span v-if="d.remaining <= 0" class="text-[13px] text-tertiary-foreground">(paid off)</span>
						<div class="flex gap-2 ml-auto">
							<button
								type="button"
								class="btn-plain btn-small"
								:disabled="d.remaining <= 0"
								:aria-disabled="d.remaining <= 0"
								@click="startEdit(d)">
								Edit
							</button>
							<button
								type="button"
								class="btn-plain btn-small btn-destructive"
								:disabled="d.remaining <= 0"
								:aria-disabled="d.remaining <= 0"
								@click="() => removeDebtById(d.id)">
								Remove
							</button>
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
