<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useBalances, type Transaction, type AccountId } from "../../composables/useBalances";
import { usePiggyBanks } from "../../composables/usePiggyBanks";
import { useInvestmentAccounts } from "../../composables/useInvestmentAccounts";
import { formatShekels } from "../../composables/useCurrency";

const router = useRouter();
const { transactions, addTransaction, updateTransaction, removeTransaction } = useBalances();
const { piggyBanks, getPiggyBank } = usePiggyBanks();
const { investmentAccounts, getInvestmentAccount } = useInvestmentAccounts();

const showAddForm = ref(false);
const editingTxId = ref<string | null>(null);
const formType = ref<Transaction["type"]>("income");
const formAmount = ref<number | "">("");
const formDate = ref("");
const formTime = ref("12:00");
const formFromId = ref<AccountId | "">("");
const formToId = ref<AccountId | "">("");
const formNote = ref("");
const formError = ref("");

const accountOptions = computed(() => {
	const options: { value: AccountId; label: string }[] = [{ value: "main", label: "Main" }];
	piggyBanks.value.forEach((p) => options.push({ value: p.id, label: `Piggy: ${p.name}` }));
	investmentAccounts.value.forEach((i) => options.push({ value: i.id, label: `Investment: ${i.name}` }));
	return options;
});

function accountLabel(id: AccountId | null): string {
	if (!id) return "—";
	if (id === "main") return "Main";
	const p = getPiggyBank(id);
	if (p) return p.name;
	const i = getInvestmentAccount(id);
	if (i) return i.name;
	return id;
}

const sortedTransactions = computed(() =>
	[...transactions.value].sort(
		(a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
	)
);

function toLocalDateTime(iso: string): string {
	const d = new Date(iso);
	const date = d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
	const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	return `${date} ${time}`;
}

function openAddForm() {
	editingTxId.value = null;
	showAddForm.value = true;
	formType.value = "income";
	formAmount.value = "";
	const now = new Date();
	formDate.value = now.toISOString().slice(0, 10);
	formTime.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	formFromId.value = "";
	formToId.value = "main";
	formNote.value = "";
	formError.value = "";
}

function openEditTx(tx: Transaction) {
	editingTxId.value = tx.id;
	showAddForm.value = true;
	formType.value = tx.type;
	formAmount.value = tx.amount;
	const d = new Date(tx.dateTime);
	formDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	formTime.value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	formFromId.value = (tx.fromId ?? "") as AccountId | "";
	formToId.value = (tx.toId ?? "") as AccountId | "";
	formNote.value = tx.note ?? "";
	formError.value = "";
}

function closeAddForm() {
	showAddForm.value = false;
	editingTxId.value = null;
}

async function submitTransaction() {
	formError.value = "";
	const amount = formAmount.value === "" ? 0 : Number(formAmount.value);
	if (amount <= 0) {
		formError.value = "Enter an amount greater than 0.";
		return;
	}
	// Treat date/time as user's local time, then store as ISO (UTC)
	const dateTime = new Date(`${formDate.value}T${formTime.value}`).toISOString();
	const payload = {
		dateTime,
		amount,
		type: formType.value,
		fromId: formType.value === "income" ? null : (formFromId.value as AccountId) || null,
		toId: formType.value === "expense" ? null : (formToId.value as AccountId) || null,
		note: formNote.value.trim() || undefined,
	} as const;
	try {
		if (formType.value === "income") {
			if (!formToId.value) {
				formError.value = "Choose where the money goes.";
				return;
			}
		} else if (formType.value === "expense") {
			if (!formFromId.value) {
				formError.value = "Choose where the money comes from.";
				return;
			}
		} else {
			if (!formFromId.value || !formToId.value || formFromId.value === formToId.value) {
				formError.value = "Choose different from and to accounts.";
				return;
			}
		}
		if (editingTxId.value) {
			await updateTransaction(editingTxId.value, payload);
		} else {
			await addTransaction(payload);
		}
		closeAddForm();
	} catch (e) {
		formError.value = e instanceof Error ? e.message : "Failed to save transaction.";
	}
}

async function removeTx(id: string) {
	try {
		await removeTransaction(id);
	} catch (_) {}
}

function parseAmountInput(event: Event) {
	const el = event.target as HTMLInputElement;
	const n = parseFloat(el.value.replace(/[,\s₪]/g, ""));
	formAmount.value = el.value === "" ? "" : (Number.isFinite(n) ? n : 0);
}
</script>

<template>
	<div class="cider cider-fixed max-w-3xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
		</nav>
		<h1>Transactions</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Add income (money from nowhere), expenses (money out), or transfers between Main and piggy banks or investment accounts.
		</p>

		<div class="mt-6 flex gap-2">
			<button type="button" class="btn-filled" @click="openAddForm">
				Add transaction
			</button>
		</div>

		<!-- Add form -->
		<section v-if="showAddForm" class="card mt-4 p-5">
			<h2 class="text-[15px] font-semibold mb-3">{{ editingTxId ? 'Edit transaction' : 'New transaction' }}</h2>
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap gap-4 items-end">
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">Type</label>
						<select v-model="formType" class="min-w-32">
							<option value="income">Income</option>
							<option value="expense">Expense</option>
							<option value="transfer">Transfer</option>
						</select>
					</div>
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">Amount (₪)</label>
						<input
							v-model="formAmount"
							type="text"
							inputmode="decimal"
							class="w-28 text-right"
							placeholder="0"
							@input="parseAmountInput" />
					</div>
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">Date</label>
						<input v-model="formDate" type="date" />
					</div>
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">Time</label>
						<input v-model="formTime" type="time" step="60" />
					</div>
				</div>
				<div v-if="formType === 'income'" class="flex flex-wrap gap-4 items-end">
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">To</label>
						<select v-model="formToId" class="min-w-48">
							<option value="">Select…</option>
							<option v-for="opt in accountOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
						</select>
					</div>
				</div>
				<div v-else-if="formType === 'expense'" class="flex flex-wrap gap-4 items-end">
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">From</label>
						<select v-model="formFromId" class="min-w-48">
							<option value="">Select…</option>
							<option v-for="opt in accountOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
						</select>
					</div>
				</div>
				<div v-else class="flex flex-wrap gap-4 items-end">
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">From</label>
						<select v-model="formFromId" class="min-w-48">
							<option value="">Select…</option>
							<option v-for="opt in accountOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
						</select>
					</div>
					<div>
						<label class="block text-[13px] text-tertiary-foreground mb-1">To</label>
						<select v-model="formToId" class="min-w-48">
							<option value="">Select…</option>
							<option v-for="opt in accountOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
						</select>
					</div>
				</div>
				<div>
					<label class="block text-[13px] text-tertiary-foreground mb-1">Note (optional)</label>
					<input v-model="formNote" type="text" class="w-full max-w-md" placeholder="e.g. Groceries" />
				</div>
				<p v-if="formError" class="text-destructive text-[14px]">{{ formError }}</p>
				<div class="flex gap-2">
					<button type="button" class="btn-filled" @click="submitTransaction">{{ editingTxId ? 'Save' : 'Add' }}</button>
					<button type="button" class="btn-gray" @click="closeAddForm">Cancel</button>
				</div>
			</div>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				History
			</h2>
			<p v-if="sortedTransactions.length === 0" class="text-[15px] text-tertiary-foreground">
				No transactions yet.
			</p>
			<div v-else class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="tx in sortedTransactions"
					:key="tx.id"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<span class="text-[13px] text-tertiary-foreground shrink-0">{{ toLocalDateTime(tx.dateTime) }}</span>
					<span class="capitalize text-[15px]">{{ tx.type }}</span>
					<span class="tabular-nums font-medium" :class="tx.type === 'expense' ? 'text-destructive' : ''">
						{{ tx.type === 'expense' ? '−' : '+' }}{{ formatShekels(tx.amount) }}
					</span>
					<span class="text-[14px] text-tertiary-foreground">
						{{ tx.type === 'income' ? '→ ' + accountLabel(tx.toId) : tx.type === 'expense' ? accountLabel(tx.fromId) + ' →' : accountLabel(tx.fromId) + ' → ' + accountLabel(tx.toId) }}
					</span>
					<span v-if="tx.note" class="text-[14px] text-tertiary-foreground truncate max-w-32" :title="tx.note">{{ tx.note }}</span>
					<div class="flex gap-1 ml-auto">
						<button type="button" class="btn-plain btn-small" aria-label="Edit transaction" @click="openEditTx(tx)">
							Edit
						</button>
						<button
							type="button"
							class="btn-plain btn-small btn-destructive"
							aria-label="Remove transaction"
							@click="() => removeTx(tx.id)">
							Remove
						</button>
					</div>
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
