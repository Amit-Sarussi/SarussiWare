<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useMonthlyPay, type Subscription } from "../../composables/useMonthlyPay";
import { formatShekels } from "../../composables/useCurrency";

const router = useRouter();

const { subscriptions, totalSubscriptionAmount, addSubscription, updateSubscription, removeSubscription } = useMonthlyPay();

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
	const amount = newAmount.value === "" ? 0 : Number(newAmount.value);
	if (!name) {
		addError.value = "Enter a name.";
		return;
	}
	if (amount <= 0) {
		addError.value = "Enter an amount greater than 0.";
		return;
	}
	try {
		await addSubscription(name, amount);
		newName.value = "";
		newAmount.value = "";
	} catch (e) {
		addError.value = e instanceof Error ? e.message : "Failed to add subscription.";
	}
}

function startEdit(sub: Subscription) {
	editingId.value = sub.id;
	editingName.value = sub.name;
	editingAmount.value = sub.amount;
}

function cancelEdit() {
	editingId.value = null;
	editingName.value = "";
	editingAmount.value = 0;
}

async function saveEdit() {
	if (editingId.value === null) return;
	try {
		await updateSubscription(editingId.value, editingName.value, editingAmount.value);
		cancelEdit();
	} catch (_) {}
}

async function removeSub(id: string) {
	try {
		await removeSubscription(id);
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
		<h1>Manage subscriptions</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Monthly subscriptions are subtracted from your income each month. They appear in the overview.
		</p>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Add subscription
			</h2>
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-0">
					<label for="sub-name" class="block text-[13px] text-tertiary-foreground mb-1">Name</label>
					<input
						id="sub-name"
						v-model="newName"
						type="text"
						class="w-48"
						placeholder="e.g. Netflix"
						@keydown.enter.prevent="startAdd" />
				</div>
				<div class="min-w-0">
					<label for="sub-amount" class="block text-[13px] text-tertiary-foreground mb-1">Amount (₪/month)</label>
					<input
						id="sub-amount"
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
					:disabled="!newName.trim() || newAmount === '' || Number(newAmount) <= 0"
					@click="startAdd">
					Add
				</button>
			</div>
			<p v-if="addError" class="text-destructive text-[14px] mt-2">{{ addError }}</p>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Your subscriptions
			</h2>
			<p v-if="subscriptions.length === 0" class="text-[15px] text-tertiary-foreground">
				No subscriptions yet. Add one above.
			</p>
			<div
				v-else
				class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="sub in subscriptions"
					:key="sub.id"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<template v-if="editingId === sub.id">
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
						<span class="min-w-40 text-[15px] font-medium">{{ sub.name }}</span>
						<span class="text-[15px] tabular-nums">{{ formatShekels(sub.amount) }}/mo</span>
						<div class="flex gap-2 ml-auto">
							<button type="button" class="btn-plain btn-small" @click="startEdit(sub)">Edit</button>
							<button type="button" class="btn-plain btn-small btn-destructive" @click="() => removeSub(sub.id)">Remove</button>
						</div>
					</template>
				</div>
			</div>
			<p v-if="subscriptions.length > 0" class="text-[14px] text-tertiary-foreground mt-3">
				Total: {{ formatShekels(totalSubscriptionAmount) }} per month
			</p>
		</section>
	</div>
</template>

<style scoped>
.list-group-row:hover {
	background: var(--color-panel-hover, var(--color-panel));
}
</style>
