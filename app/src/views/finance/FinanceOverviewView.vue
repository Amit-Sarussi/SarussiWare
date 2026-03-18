<script setup lang="ts">
import { ref, computed } from "vue";
import {
	ArcElement,
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Filler,
	Tooltip,
	Legend,
} from "chart.js";
import { Doughnut, Line } from "vue-chartjs";
import { useMonthlyPay } from "../../composables/useMonthlyPay";
import { useBalances, type Transaction, type AccountId } from "../../composables/useBalances";
import { usePiggyBanks } from "../../composables/usePiggyBanks";
import { useInvestmentAccounts } from "../../composables/useInvestmentAccounts";
import { formatShekels, formatShekelsCompact } from "../../composables/useCurrency";

ChartJS.register(
	ArcElement,
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Filler,
	Tooltip,
	Legend,
);

const { accumulatedByMonth, subscriptions, totalSubscriptionAmount } = useMonthlyPay();
const { transactions, addTransaction, updateTransaction, removeTransaction, balancesNow, balancesAfterThisMonth } = useBalances();
const { piggyBanks, getPiggyBank } = usePiggyBanks();
const { investmentAccounts, getInvestmentAccount } = useInvestmentAccounts();

// Transaction form (manage from overview)
const showAddTxForm = ref(false);
const editingTxId = ref<string | null>(null);
const formType = ref<Transaction["type"]>("income");
const formAmount = ref<number | "">("");
const formDate = ref("");
const formTime = ref("12:00");
const formFromId = ref<AccountId | "">("");
const formToId = ref<AccountId | "">("");
const formNote = ref("");
const formError = ref("");
const removeError = ref("");

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

function openAddTxForm() {
	editingTxId.value = null;
	showAddTxForm.value = true;
	formType.value = "income";
	formAmount.value = "";
	const now = new Date();
	formDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	formTime.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	formFromId.value = "";
	formToId.value = "main";
	formNote.value = "";
	formError.value = "";
}

function openEditTx(tx: Transaction) {
	editingTxId.value = tx.id;
	showAddTxForm.value = true;
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

function closeAddTxForm() {
	showAddTxForm.value = false;
	editingTxId.value = null;
}

async function removeTx(id: string) {
	removeError.value = "";
	try {
		await removeTransaction(id);
	} catch (e) {
		removeError.value = e instanceof Error ? e.message : "Failed to remove transaction.";
	}
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
		closeAddTxForm();
	} catch (e) {
		formError.value = e instanceof Error ? e.message : "Failed to save transaction.";
	}
}

function parseTxAmountInput(event: Event) {
	const el = event.target as HTMLInputElement;
	const n = parseFloat(el.value.replace(/[,\s₪]/g, ""));
	formAmount.value = el.value === "" ? "" : (Number.isFinite(n) ? n : 0);
}

/** Projected main balance over 24 months (salary split only, no future transactions) */
const mainBalanceProjection = computed(() => {
	const arr = accumulatedByMonth.value;
	if (arr.length === 0) return [];
	const remainderPct = Math.max(
		0,
		1
			- piggyBanks.value.reduce((s, p) => s + p.percentage, 0) / 100
			- investmentAccounts.value.reduce((s, i) => s + i.percentage, 0) / 100
	);
	let mainAcc = 0;
	return arr.map((m, i) => {
		const prevNet = i === 0 ? 0 : arr[i - 1].netAccumulated;
		const netThisMonth = m.netAccumulated - prevNet;
		mainAcc += netThisMonth * remainderPct;
		return mainAcc;
	});
});

const chartData = computed(() => ({
	labels: accumulatedByMonth.value.map((m) => m.label),
	datasets: [
		{
			label: "Main balance (projected)",
			data: mainBalanceProjection.value,
			fill: true,
			backgroundColor: "rgba(0, 122, 255, 0.15)",
			borderColor: "rgba(0, 122, 255, 0.8)",
			borderWidth: 2,
			tension: 0.35,
			pointRadius: 2.5,
			pointHoverRadius: 5,
		},
	],
}));

const chartOptions = ({
	responsive: true,
	maintainAspectRatio: false,
	interaction: {
		mode: "index" as const,
		intersect: false,
	},
	plugins: {
		legend: {
			display: false,
		},
		tooltip: {
			callbacks: {
				label(tooltipItem: { raw: unknown }) {
					return `Main: ${formatShekels(Number(tooltipItem.raw))}`;
				},
			},
		},
	},
	scales: {
		x: {
			grid: { display: false },
			ticks: {
				maxRotation: 45,
				minRotation: 45,
				maxTicksLimit: 12,
				font: { size: 11 },
			},
		},
		y: {
			beginAtZero: true,
			grid: { color: "rgba(0,0,0,0.06)" },
			ticks: {
				callback(value: number | string) {
					const n = typeof value === "number" ? value : parseFloat(String(value));
					const sign = n < 0 ? "−" : "";
					return sign + formatShekelsCompact(Math.abs(n));
				},
			},
		},
	},
}) as import("chart.js").ChartOptions<"line">;

/** Doughnut: how net income is split (main remainder + piggy % + investment %) */
const SPLIT_MAIN_COLOR = "rgba(0, 122, 255, 0.85)";
const SPLIT_PIGGY_COLORS = ["rgba(16, 185, 129, 0.9)", "rgba(20, 184, 166, 0.9)", "rgba(34, 197, 94, 0.9)"];
const SPLIT_INV_COLORS = ["rgba(139, 92, 246, 0.9)", "rgba(168, 85, 247, 0.9)", "rgba(99, 102, 241, 0.9)"];

const splitChartData = computed(() => {
	const totalPiggyPct = piggyBanks.value.reduce((s, p) => s + p.percentage, 0) / 100;
	const totalInvPct = investmentAccounts.value.reduce((s, i) => s + i.percentage, 0) / 100;
	const remainderPct = Math.max(0, 1 - totalPiggyPct - totalInvPct) * 100;
	const labels: string[] = [];
	const data: number[] = [];
	const backgroundColor: string[] = [];
	if (remainderPct > 0) {
		labels.push("Main");
		data.push(Math.round(remainderPct * 10) / 10);
		backgroundColor.push(SPLIT_MAIN_COLOR);
	}
	piggyBanks.value.forEach((p, i) => {
		if (p.percentage > 0) {
			labels.push(p.name);
			data.push(p.percentage);
			backgroundColor.push(SPLIT_PIGGY_COLORS[i % SPLIT_PIGGY_COLORS.length]);
		}
	});
	investmentAccounts.value.forEach((inv, i) => {
		if (inv.percentage > 0) {
			labels.push(inv.name);
			data.push(inv.percentage);
			backgroundColor.push(SPLIT_INV_COLORS[i % SPLIT_INV_COLORS.length]);
		}
	});
	return {
		labels,
		datasets: [{ data, backgroundColor, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }],
	};
});

const splitChartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		legend: { position: "right" as const },
		tooltip: {
			callbacks: {
				label(ctx: { label: string; parsed: number }) {
					return `${ctx.label}: ${ctx.parsed}%`;
				},
			},
		},
	},
};

/** Card colors for piggy banks (green tint) and investment (purple tint) */
const piggyCardColors = [
	"bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200",
	"bg-teal-500/15 border-teal-500/40 text-teal-800 dark:text-teal-200",
	"bg-green-500/15 border-green-500/40 text-green-800 dark:text-green-200",
];
const invCardColors = [
	"bg-violet-500/15 border-violet-500/40 text-violet-800 dark:text-violet-200",
	"bg-purple-500/15 border-purple-500/40 text-purple-800 dark:text-purple-200",
	"bg-indigo-500/15 border-indigo-500/40 text-indigo-800 dark:text-indigo-200",
];
function piggyColor(index: number) {
	return piggyCardColors[index % piggyCardColors.length];
}
function invColor(index: number) {
	return invCardColors[index % invCardColors.length];
}
</script>

<template>
	<div class="cider cider-fixed max-w-4xl">
		<h1>Finance overview</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Current balances and projections. Salary is applied at end of each month. Manage transactions below; edit pay, subscriptions, and allocations in Manage.
		</p>

		<!-- Main money -->
		<section class="mt-6 grid gap-4 sm:grid-cols-2">
			<div class="card p-5">
				<p class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-1">
					Balance
				</p>
				<p class="text-2xl font-semibold tabular-nums">
					{{ formatShekels(balancesNow.main) }}
				</p>
				<p class="text-[13px] text-tertiary-foreground mt-1">
					Main balance as of today (before this month’s salary)
				</p>
			</div>
			<div class="card p-5">
				<p class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-1">
					After this month’s salary
				</p>
				<p class="text-2xl font-semibold tabular-nums">
					{{ formatShekels(balancesAfterThisMonth.main) }}
				</p>
				<p class="text-[13px] text-tertiary-foreground mt-1">
					Main balance at end of current month (salary applied)
				</p>
			</div>
		</section>

		<!-- Income split (doughnut) -->
		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				How net income is split
			</h2>
			<p class="text-[14px] text-tertiary-foreground mb-2">
				Share of each month’s net income (after subscriptions) going to main balance, piggy banks, and investment accounts.
			</p>
			<div class="card p-4 flex flex-col sm:flex-row items-center justify-center gap-4" style="min-height: 280px;">
				<div v-if="splitChartData.labels.length > 0" class="w-full sm:w-64 h-64 shrink-0">
					<Doughnut :data="splitChartData" :options="splitChartOptions" />
				</div>
				<p v-else class="text-[15px] text-tertiary-foreground">No allocations set. Add piggy banks or investment accounts in Manage.</p>
			</div>
		</section>

		<!-- Transactions -->
		<section class="mt-6">
			<div class="flex flex-wrap items-center justify-between gap-3 mb-3">
				<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide m-0">
					Transactions
				</h2>
				<button type="button" class="btn-filled btn-small" @click="openAddTxForm">
					Add transaction
				</button>
			</div>
			<!-- Add form -->
			<div v-if="showAddTxForm" class="card p-5 mb-4">
				<h3 class="text-[15px] font-semibold mb-3">{{ editingTxId ? 'Edit transaction' : 'New transaction' }}</h3>
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
								:value="formAmount === '' ? '' : formAmount"
								type="text"
								inputmode="decimal"
								class="w-28 text-right"
								placeholder="0"
								@input="parseTxAmountInput" />
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
						<button type="button" class="btn-gray" @click="closeAddTxForm">Cancel</button>
					</div>
				</div>
			</div>
			<p v-if="removeError" class="text-destructive text-[14px] mb-2">{{ removeError }}</p>
			<p v-if="sortedTransactions.length === 0 && !showAddTxForm" class="text-[15px] text-tertiary-foreground">
				No transactions yet. Add one above.
			</p>
			<div
				v-else-if="sortedTransactions.length > 0"
				class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="tx in sortedTransactions"
					:key="tx.id"
					class="tx-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
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

		<!-- Piggy banks -->
		<section v-if="piggyBanks.length > 0" class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				Piggy banks
			</h2>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<router-link
					v-for="(pb, idx) in piggyBanks"
					:key="pb.id"
					:to="{ name: 'finance-piggy-bank-detail', params: { id: pb.id } }"
					class="card p-5 no-underline text-inherit border-2 transition hover:opacity-90"
					:class="piggyColor(idx)">
					<span class="text-[15px] font-semibold">{{ pb.name }}</span>
					<p class="text-[13px] opacity-80 mt-0.5 mb-3">{{ pb.percentage }}% of net</p>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<p class="text-[11px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-0.5">Now</p>
							<p class="text-lg font-semibold tabular-nums">{{ formatShekels(balancesNow.piggyBank[pb.id] ?? 0) }}</p>
						</div>
						<div>
							<p class="text-[11px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-0.5">End of month</p>
							<p class="text-lg font-semibold tabular-nums">{{ formatShekels(balancesAfterThisMonth.piggyBank[pb.id] ?? 0) }}</p>
						</div>
					</div>
				</router-link>
			</div>
		</section>

		<!-- Investment accounts -->
		<section v-if="investmentAccounts.length > 0" class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				Investment accounts
			</h2>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<router-link
					v-for="(inv, idx) in investmentAccounts"
					:key="inv.id"
					:to="{ name: 'finance-investment-account-detail', params: { id: inv.id } }"
					class="card p-5 no-underline text-inherit border-2 transition hover:opacity-90"
					:class="invColor(idx)">
					<span class="text-[15px] font-semibold">{{ inv.name }}</span>
					<p class="text-[13px] opacity-80 mt-0.5 mb-3">{{ inv.percentage }}% of net · {{ inv.yearlyRate }}%/yr</p>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<p class="text-[11px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-0.5">Now</p>
							<p class="text-lg font-semibold tabular-nums">{{ formatShekels(balancesNow.investmentAccount[inv.id] ?? 0) }}</p>
						</div>
						<div>
							<p class="text-[11px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-0.5">End of month</p>
							<p class="text-lg font-semibold tabular-nums">{{ formatShekels(balancesAfterThisMonth.investmentAccount[inv.id] ?? 0) }}</p>
						</div>
					</div>
				</router-link>
			</div>
		</section>

		<!-- Subscriptions (read-only) -->
		<section v-if="subscriptions.length > 0" class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				Monthly subscriptions
			</h2>
			<p class="text-[14px] text-tertiary-foreground mb-2">
				Subtracted from income each month. Edit in Manage → Manage subscriptions.
			</p>
			<div class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="sub in subscriptions"
					:key="sub.id"
					class="subscription-row flex items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<span class="text-[15px]">{{ sub.name }}</span>
					<span class="tabular-nums font-medium ml-auto">{{ formatShekels(sub.amount) }}/mo</span>
				</div>
			</div>
			<p class="text-[14px] text-tertiary-foreground mt-2">
				Total: {{ formatShekels(totalSubscriptionAmount) }} per month
			</p>
		</section>

		<!-- Main balance projection chart -->
		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				Main balance over time (projected)
			</h2>
			<div class="card p-4" style="height: 320px;">
				<Line :data="chartData" :options="chartOptions" />
			</div>
		</section>
	</div>
</template>

<style scoped>
.tx-row:hover,
.subscription-row:hover {
	background: var(--color-panel-hover, var(--color-panel));
}
</style>
