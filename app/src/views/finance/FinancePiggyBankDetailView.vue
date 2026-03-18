<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
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
import { Line } from "vue-chartjs";
import { usePiggyBanks } from "../../composables/usePiggyBanks";
import { useBalances } from "../../composables/useBalances";
import { formatShekels, formatShekelsCompact } from "../../composables/useCurrency";

ChartJS.register(
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Filler,
	Tooltip,
	Legend,
);

const route = useRoute();
const router = useRouter();
const { getPiggyBank, getGrowth, updatePiggyBank } = usePiggyBanks();
const { balancesNow, balancesAfterThisMonth, getBalancesAsOf, transactions, endOfCurrentMonth } = useBalances();

const piggyBank = computed(() => {
	const id = route.params.id as string;
	return id ? getPiggyBank(id) : undefined;
});

const growth = computed(() => {
	const id = route.params.id as string;
	return id ? getGrowth(id) : [];
});

watch(
	piggyBank,
	(pb) => {
		if (route.name === "finance-piggy-bank-detail" && pb === undefined && route.params.id) {
			router.replace({ name: "finance-manage-piggy-banks" });
		}
	},
	{ immediate: true }
);

const chartData = computed(() => ({
	labels: growth.value.map((m) => m.label),
	datasets: [
		{
			label: "Saved",
			data: growth.value.map((m) => m.accumulated),
			fill: true,
			backgroundColor: "rgba(52, 199, 89, 0.2)",
			borderColor: "rgba(52, 199, 89, 0.9)",
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
		legend: { display: false },
		tooltip: {
			callbacks: {
				label(tooltipItem: { raw: unknown }) {
					return `Saved: ${formatShekels(Number(tooltipItem.raw))}`;
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
					return formatShekelsCompact(n);
				},
			},
		},
	},
}) as import("chart.js").ChartOptions<"line">;

const currentBalance = computed(() => {
	const id = route.params.id as string;
	return id ? (balancesNow.value.piggyBank[id] ?? 0) : 0;
});

const balanceEndOfMonth = computed(() => {
	const id = route.params.id as string;
	return id ? (balancesAfterThisMonth.value.piggyBank[id] ?? 0) : 0;
});

/** Chart: linear "start of month → 0 at end" and actual balance through the month. One point per day. */
const currentMonthChartData = computed(() => {
	const id = route.params.id as string;
	if (!id) return { labels: [] as string[], linearData: [] as number[], actualData: [] as number[] };
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = endOfCurrentMonth.value;
	const balanceAtStart = getBalancesAsOf(start).piggyBank[id] ?? 0;
	const today = now.getDate();
	const timePoints: Date[] = [];
	for (let day = 1; day <= today; day++) {
		if (day < today) {
			timePoints.push(new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999));
		} else {
			timePoints.push(now);
		}
	}
	const startMs = start.getTime();
	const endMs = end.getTime();
	const span = endMs - startMs;
	return {
		labels: timePoints.map((d) => {
			const day = d.getDate();
			const mon = d.toLocaleString("en", { month: "short" });
			return `${mon} ${day}`;
		}),
		linearData: timePoints.map((d) => {
			if (span <= 0) return balanceAtStart;
			const t = (d.getTime() - startMs) / span;
			return Math.max(0, balanceAtStart * (1 - t));
		}),
		actualData: timePoints.map((d) => getBalancesAsOf(d).piggyBank[id] ?? 0),
	};
});

const currentMonthChartOptions = ({
	responsive: true,
	maintainAspectRatio: false,
	interaction: { mode: "index" as const, intersect: false },
	plugins: {
		legend: { display: true, position: "top" as const },
		tooltip: {
			callbacks: {
				label(tooltipItem: { datasetIndex: number; raw: unknown }) {
					const label = tooltipItem.datasetIndex === 0 ? "Linear (to 0)" : "Actual";
					return `${label}: ${formatShekels(Number(tooltipItem.raw))}`;
				},
			},
		},
	},
	scales: {
		x: {
			grid: { display: false },
			ticks: { maxRotation: 45, minRotation: 45, maxTicksLimit: 10, font: { size: 11 } },
		},
		y: {
			beginAtZero: true,
			grid: { color: "rgba(0,0,0,0.06)" },
			ticks: {
				callback(value: number | string) {
					const n = typeof value === "number" ? value : parseFloat(String(value));
					return formatShekelsCompact(n);
				},
			},
		},
	},
}) as import("chart.js").ChartOptions<"line">;

const currentMonthChartDatasets = computed(() => ({
	labels: currentMonthChartData.value.labels,
	datasets: [
		{
			label: "Linear (to 0)",
			data: currentMonthChartData.value.linearData,
			borderColor: "rgba(142, 142, 147, 0.8)",
			backgroundColor: "transparent",
			borderWidth: 2,
			borderDash: [6, 4],
			tension: 0,
			pointRadius: 2,
			pointHoverRadius: 4,
		},
		{
			label: "Actual",
			data: currentMonthChartData.value.actualData,
			fill: true,
			backgroundColor: "rgba(52, 199, 89, 0.15)",
			borderColor: "rgba(52, 199, 89, 0.9)",
			borderWidth: 2,
			tension: 0.35,
			pointRadius: 3,
			pointHoverRadius: 5,
		},
	],
}));

const showEditForm = ref(false);
const editName = ref("");
const editPercentage = ref<number>(0);
const editError = ref("");

function parsePercentage(value: string): number {
	const n = parseFloat(value.replace(/[,\s%]/g, ""));
	return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function openEdit() {
	if (piggyBank.value) {
		editName.value = piggyBank.value.name;
		editPercentage.value = piggyBank.value.percentage;
		editError.value = "";
		showEditForm.value = true;
	}
}

function closeEdit() {
	showEditForm.value = false;
	editName.value = "";
	editPercentage.value = 0;
	editError.value = "";
}

async function saveEdit() {
	const id = route.params.id as string;
	if (!id || !editName.value.trim()) {
		editError.value = "Enter a name.";
		return;
	}
	const rawPct = Number(editPercentage.value);
	if (!Number.isFinite(rawPct) || rawPct < 1 || rawPct > 100) {
		editError.value = "Enter a percentage between 1 and 100.";
		return;
	}
	const pct = Math.round(Math.max(1, Math.min(100, rawPct)) * 100) / 100;
	try {
		await updatePiggyBank(id, editName.value.trim(), pct);
		closeEdit();
	} catch (e) {
		editError.value = e instanceof Error ? e.message : "Failed to save.";
	}
}
</script>

<template>
	<div v-if="piggyBank" class="cider cider-fixed max-w-4xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
			<button type="button" class="btn-filled btn-small" @click="openEdit">
				Edit
			</button>
		</nav>
		<div v-if="showEditForm" class="card p-5 mb-6">
			<h2 class="text-[15px] font-semibold mb-3">Edit piggy bank</h2>
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-0">
					<label class="block text-[13px] text-tertiary-foreground mb-1">Name</label>
					<input v-model="editName" type="text" class="w-48" placeholder="e.g. Vacation fund" />
				</div>
				<div class="min-w-0">
					<label class="block text-[13px] text-tertiary-foreground mb-1">% of net income</label>
					<input
						:value="editPercentage"
						type="text"
						inputmode="decimal"
						class="w-24 text-right"
						placeholder="10"
						@input="(e) => { editPercentage = parsePercentage((e.target as HTMLInputElement).value); }" />
				</div>
				<span class="text-tertiary-foreground text-[15px] pb-2">%</span>
				<button type="button" class="btn-filled btn-small" @click="saveEdit">Save</button>
				<button type="button" class="btn-gray btn-small" @click="closeEdit">Cancel</button>
			</div>
			<p v-if="editError" class="text-destructive text-[14px] mt-2">{{ editError }}</p>
		</div>
		<h1>{{ piggyBank.name }}</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			{{ piggyBank.percentage }}% of your net income (after subscriptions) goes here each month. Projected over the next 24 months.
		</p>

		<div class="grid gap-4 mt-6 sm:grid-cols-2">
			<div class="card p-5">
				<p class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-1">
					Now
				</p>
				<p class="text-2xl font-semibold tabular-nums">
					{{ formatShekels(currentBalance) }}
				</p>
				<p class="text-[13px] text-tertiary-foreground mt-1">
					Balance as of today (before this month’s allocation)
				</p>
			</div>
			<div class="card p-5">
				<p class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-1">
					End of month
				</p>
				<p class="text-2xl font-semibold tabular-nums">
					{{ formatShekels(balanceEndOfMonth) }}
				</p>
				<p class="text-[13px] text-tertiary-foreground mt-1">
					Balance at end of current month (this month’s allocation applied)
				</p>
			</div>
		</div>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				This month
			</h2>
			<p class="text-[14px] text-tertiary-foreground mb-2">
				Linear line: balance at start of month going down to 0 by end of month. Actual: balance over time so far.
			</p>
			<div class="card p-4" style="height: 260px;">
				<Line :data="currentMonthChartDatasets" :options="currentMonthChartOptions" />
			</div>
		</section>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-3">
				Growth over time
			</h2>
			<div class="card p-4" style="height: 320px;">
				<Line :data="chartData" :options="chartOptions" />
			</div>
		</section>
	</div>
</template>

<style scoped>
</style>
