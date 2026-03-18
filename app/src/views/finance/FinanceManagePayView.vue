<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useMonthlyPay } from "../../composables/useMonthlyPay";

const router = useRouter();

const {
	monthKeys,
	getMonthPay,
	setMonthPay,
	setMonthPayAndForward,
	formatMonthLabel,
} = useMonthlyPay();

const DEBOUNCE_MS = 400;
let payDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingPay = ref<{ monthKey: string; amount: number } | null>(null);
/** Local value per month while typing, so input doesn't revert before save */
const pendingInputs = ref<Record<string, string>>({});

function parseAmount(value: string): number {
	const n = parseFloat(value.replace(/[,\s₪]/g, ""));
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatAmount(value: number): string {
	if (value === 0) return "";
	return value % 1 === 0 ? String(value) : String(Math.round(value * 100) / 100);
}

function displayValue(monthKey: string): string {
	if (pendingInputs.value[monthKey] !== undefined) return pendingInputs.value[monthKey];
	return formatAmount(getMonthPay(monthKey));
}

async function flushPayDebounce() {
	if (payDebounceTimer !== null) {
		clearTimeout(payDebounceTimer);
		payDebounceTimer = null;
	}
	const p = pendingPay.value;
	pendingPay.value = null;
	if (p) {
		await setMonthPay(p.monthKey, p.amount);
		delete pendingInputs.value[p.monthKey];
	}
}

function onInput(monthKey: string, event: Event): void {
	const el = event.target as HTMLInputElement;
	const raw = el.value;
	const amount = parseAmount(raw);
	pendingInputs.value[monthKey] = raw;
	pendingPay.value = { monthKey, amount };
	if (payDebounceTimer !== null) clearTimeout(payDebounceTimer);
	payDebounceTimer = setTimeout(flushPayDebounce, DEBOUNCE_MS);
}

onUnmounted(() => {
	if (payDebounceTimer !== null) clearTimeout(payDebounceTimer);
});

async function applySameForRest(monthKey: string): Promise<void> {
	const amount = getMonthPay(monthKey);
	await setMonthPayAndForward(monthKey, amount);
}
</script>

<template>
	<div class="cider cider-fixed max-w-2xl">
		<nav class="flex items-center gap-2 text-[15px] text-tertiary-foreground mb-4">
			<button type="button" class="btn-plain btn-small" @click="router.back()">
				← Back
			</button>
		</nav>
		<h1>Manage pay</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Set your expected pay for each month in shekels. Use “Same for following” to fill the rest of the months from that value.
		</p>

		<section class="mt-6">
			<h2 class="text-[13px] font-semibold text-tertiary-foreground uppercase tracking-wide mb-2">
				Next 24 months
			</h2>
			<div class="list-group rounded-lg overflow-hidden border border-(--panel-border)">
				<div
					v-for="monthKey in monthKeys"
					:key="monthKey"
					class="list-group-row flex flex-wrap items-center gap-3 px-4 py-3 bg-(--color-panel) border-b border-(--panel-border) last:border-b-0">
					<span class="min-w-40 text-[15px] font-medium">
						{{ formatMonthLabel(monthKey) }}
					</span>
					<div class="flex items-center gap-2 flex-1 min-w-0">
						<span class="text-tertiary-foreground shrink-0" aria-hidden="true">₪</span>
						<label :for="`pay-${monthKey}`" class="sr-only">
							Pay for {{ formatMonthLabel(monthKey) }} in shekels
						</label>
						<input
							:id="`pay-${monthKey}`"
							type="text"
							inputmode="decimal"
							:value="displayValue(monthKey)"
							placeholder="0"
							class="input-numeric w-28 text-right"
							@input="onInput(monthKey, $event)" />
						<button
							type="button"
							class="btn-plain btn-small text-tertiary-foreground shrink-0"
							:disabled="getMonthPay(monthKey) <= 0"
							:aria-label="`Use this amount for ${formatMonthLabel(monthKey)} and all following months`"
							@click="applySameForRest(monthKey)">
							Same for following
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
.input-numeric {
	-moz-appearance: textfield;
}
.input-numeric::-webkit-outer-spin-button,
.input-numeric::-webkit-inner-spin-button {
	appearance: none;
	margin: 0;
}
</style>
