<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useInvestmentAccounts, type InvestmentAccount } from "../../composables/useInvestmentAccounts";

const router = useRouter();

const {
	investmentAccounts,
	addInvestmentAccount,
	updateInvestmentAccount,
	removeInvestmentAccount,
} = useInvestmentAccounts();

const newName = ref("");
const newPercentage = ref<number | "">("");
const newYearlyRate = ref<number | "">("");
const addError = ref("");

const editingId = ref<string | null>(null);
const editingName = ref("");
const editingPercentage = ref<number>(0);
const editingYearlyRate = ref<number>(0);

function parsePercentage(value: string): number {
	const n = parseFloat(value.replace(/[,\s%]/g, ""));
	return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function parseRate(value: string): number {
	const n = parseFloat(value.replace(/[,\s%]/g, ""));
	return Number.isFinite(n) ? n : 0;
}

async function startAdd() {
	addError.value = "";
	const name = newName.value.trim();
	const pct = newPercentage.value === "" ? 0 : parsePercentage(String(newPercentage.value));
	const rate = newYearlyRate.value === "" ? 0 : parseRate(String(newYearlyRate.value));
	if (!name) {
		addError.value = "Enter a name.";
		return;
	}
	if (pct < 0 || pct > 100) {
		addError.value = "Enter a percentage between 0 and 100.";
		return;
	}
	try {
		await addInvestmentAccount(name, pct, rate);
		newName.value = "";
		newPercentage.value = "";
		newYearlyRate.value = "";
	} catch (e) {
		addError.value = e instanceof Error ? e.message : "Failed to add.";
	}
}

function startEdit(inv: InvestmentAccount) {
	editingId.value = inv.id;
	editingName.value = inv.name;
	editingPercentage.value = inv.percentage;
	editingYearlyRate.value = inv.yearlyRate;
}

function cancelEdit() {
	editingId.value = null;
	editingName.value = "";
	editingPercentage.value = 0;
	editingYearlyRate.value = 0;
}

async function saveEdit() {
	if (editingId.value === null) return;
	const pct = Math.max(0, Math.min(100, editingPercentage.value));
	try {
		await updateInvestmentAccount(
			editingId.value,
			editingName.value,
			pct,
			editingYearlyRate.value
		);
		cancelEdit();
	} catch (_) {}
}

async function removeInv(id: string) {
	try {
		await removeInvestmentAccount(id);
	} catch (_) {}
}

function onNewPctInput(event: Event) {
	const el = event.target as HTMLInputElement;
	newPercentage.value = el.value === "" ? "" : parsePercentage(el.value);
}

function onNewRateInput(event: Event) {
	const el = event.target as HTMLInputElement;
	newYearlyRate.value = el.value === "" ? "" : parseRate(el.value);
}

function onEditPctInput(event: Event) {
	const el = event.target as HTMLInputElement;
	editingPercentage.value = parsePercentage(el.value);
}

function onEditRateInput(event: Event) {
	const el = event.target as HTMLInputElement;
	editingYearlyRate.value = parseRate(el.value);
}
</script>

<template>
	<div class="cider cider-fixed max-w-2xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
		</nav>
		<h1>Manage investment accounts</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Like piggy banks, but the balance grows each month by a yearly rate. Set the rate for the whole year; it’s applied monthly as the 12th root.
		</p>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Add investment account
			</h2>
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-0">
					<label for="inv-name" class="block text-[13px] text-tertiary-foreground mb-1">Name</label>
					<input
						id="inv-name"
						v-model="newName"
						type="text"
						class="w-48"
						placeholder="e.g. Index fund"
						@keydown.enter.prevent="startAdd" />
				</div>
				<div class="min-w-0">
					<label for="inv-pct" class="block text-[13px] text-tertiary-foreground mb-1">% of net income</label>
					<input
						id="inv-pct"
						:value="newPercentage === '' ? '' : newPercentage"
						type="text"
						inputmode="decimal"
						class="w-24 text-right"
						placeholder="10"
						@input="onNewPctInput"
						@keydown.enter.prevent="startAdd" />
				</div>
				<span class="text-tertiary-foreground text-[15px] pb-2">%</span>
				<div class="min-w-0">
					<label for="inv-rate" class="block text-[13px] text-tertiary-foreground mb-1">Yearly rate %</label>
					<input
						id="inv-rate"
						:value="newYearlyRate === '' ? '' : newYearlyRate"
						type="text"
						inputmode="decimal"
						class="w-24 text-right"
						placeholder="5"
						@input="onNewRateInput"
						@keydown.enter.prevent="startAdd" />
				</div>
				<span class="text-tertiary-foreground text-[15px] pb-2">%/year</span>
				<button
					type="button"
					class="btn-filled btn-small"
					:disabled="!newName.trim() || newPercentage === '' || parsePercentage(String(newPercentage)) < 0 || parsePercentage(String(newPercentage)) > 100"
					@click="startAdd">
					Add
				</button>
			</div>
			<p v-if="addError" class="text-destructive text-[14px] mt-2">{{ addError }}</p>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Your investment accounts
			</h2>
			<p v-if="investmentAccounts.length === 0" class="text-[15px] text-tertiary-foreground">
				No investment accounts yet. Add one above.
			</p>
			<div
				v-else
				class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="inv in investmentAccounts"
					:key="inv.id"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<template v-if="editingId === inv.id">
						<input
							v-model="editingName"
							type="text"
							class="min-w-0 flex-1 max-w-40"
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
						<input
							:value="editingYearlyRate"
							type="text"
							inputmode="decimal"
							class="w-20 text-right"
							@input="onEditRateInput"
							@keydown.enter="saveEdit"
							@keydown.escape="cancelEdit" />
						<span class="text-tertiary-foreground">%/yr</span>
						<div class="flex gap-2 shrink-0">
							<button type="button" class="btn-filled btn-small" @click="saveEdit">Save</button>
							<button type="button" class="btn-gray btn-small" @click="cancelEdit">Cancel</button>
						</div>
					</template>
					<template v-else>
						<router-link
							:to="{ name: 'finance-investment-account-detail', params: { id: inv.id } }"
							class="min-w-40 text-[15px] font-medium no-underline text-inherit hover:underline">
							{{ inv.name }}
						</router-link>
						<span class="text-[15px] text-tertiary-foreground">{{ inv.percentage }}%</span>
						<span class="text-[15px] text-tertiary-foreground">{{ inv.yearlyRate }}%/yr</span>
						<div class="flex gap-2 ml-auto">
							<router-link
								:to="{ name: 'finance-investment-account-detail', params: { id: inv.id } }"
								class="btn-plain btn-small">
								View growth
							</router-link>
							<button type="button" class="btn-plain btn-small" @click="startEdit(inv)">Edit</button>
							<button type="button" class="btn-plain btn-small btn-destructive" @click="() => removeInv(inv.id)">Remove</button>
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
