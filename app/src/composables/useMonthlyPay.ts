import { computed } from "vue";
import { trpc } from "../trpc";
import { useFinanceData } from "./useFinanceData";

export interface Subscription {
	id: string;
	name: string;
	amount: number;
}

/** YYYY-MM for the month at index 0..23 from now */
function getNext24MonthKeys(): string[] {
	const keys: string[] = [];
	const d = new Date();
	for (let i = 0; i < 24; i++) {
		const y = d.getFullYear();
		const m = d.getMonth() + 1;
		keys.push(`${y}-${String(m).padStart(2, "0")}`);
		d.setMonth(d.getMonth() + 1);
	}
	return keys;
}

const MONTH_LABELS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

function formatMonthLabel(monthKey: string): string {
	const [y, m] = monthKey.split("-").map(Number);
	if (!m || m < 1 || m > 12) return monthKey;
	return `${MONTH_LABELS[m - 1]} ${y}`;
}

const monthKeys = getNext24MonthKeys();

export function useMonthlyPay() {
	const { monthlyPayList, subscriptionsList } = useFinanceData();

	/** monthKey -> pay amount (from loaded list) */
	const monthlyPay = computed(() =>
		Object.fromEntries(monthlyPayList.value.map((p) => [p.monthKey, p.amount]))
	);

	/** Resolved pay for each of the 24 months (set value or 0) */
	const resolvedPayByMonth = computed(() => {
		const pay = monthlyPay.value;
		const result: Record<string, number> = {};
		let lastSet = 0;
		for (const key of monthKeys) {
			if (pay[key] !== undefined && pay[key] !== null) {
				lastSet = pay[key];
			}
			result[key] = lastSet;
		}
		return result;
	});

	const subscriptions = computed(() => subscriptionsList.value);

	const totalSubscriptionAmount = computed(() =>
		subscriptions.value.reduce((sum, s) => sum + s.amount, 0)
	);

	/** For overview: label, pay, accumulated (gross), net accumulated (after subscriptions) */
	const accumulatedByMonth = computed(() => {
		const resolved = resolvedPayByMonth.value;
		const subsPerMonth = totalSubscriptionAmount.value;
		let acc = 0;
		return monthKeys.map((key, index) => {
			const pay = resolved[key] ?? 0;
			acc += pay;
			const accumulated = acc;
			const subscriptionsPaidSoFar = (index + 1) * subsPerMonth;
			const netAccumulated = accumulated - subscriptionsPaidSoFar;
			return {
				monthKey: key,
				label: formatMonthLabel(key),
				pay,
				accumulated,
				subscriptionsPaidSoFar,
				netAccumulated,
			};
		});
	});

	function getMonthPay(monthKey: string): number {
		return resolvedPayByMonth.value[monthKey] ?? 0;
	}

	async function setMonthPay(monthKey: string, amount: number): Promise<void> {
		await trpc.finance.monthlyPay.set.mutate({ monthKey, amount });
		const idx = monthlyPayList.value.findIndex((p) => p.monthKey === monthKey);
		if (idx >= 0) {
			monthlyPayList.value = monthlyPayList.value.map((p, i) =>
				i === idx ? { ...p, amount } : p
			);
		} else {
			monthlyPayList.value = [...monthlyPayList.value, { monthKey, amount }].sort(
				(a, b) => a.monthKey.localeCompare(b.monthKey)
			);
		}
	}

	async function setMonthPayAndForward(monthKey: string, amount: number): Promise<void> {
		await trpc.finance.monthlyPay.setForward.mutate({ fromMonthKey: monthKey, amount });
		const idx = monthKeys.indexOf(monthKey);
		const updated = new Map(monthlyPayList.value.map((p) => [p.monthKey, p.amount]));
		if (idx === -1) {
			// Month outside 24-month window: server updated that month only; keep client in sync
			updated.set(monthKey, amount);
		} else {
			for (let i = idx; i < monthKeys.length; i++) {
				updated.set(monthKeys[i], amount);
			}
		}
		monthlyPayList.value = [...updated.entries()]
			.map(([monthKey, amount]) => ({ monthKey, amount }))
			.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
	}

	async function addSubscription(name: string, amount: number): Promise<Subscription> {
		const sub = await trpc.finance.subscriptions.create.mutate({ name: name.trim(), amount });
		subscriptionsList.value = [...subscriptionsList.value, sub];
		return sub;
	}

	async function updateSubscription(id: string, name: string, amount: number): Promise<void> {
		await trpc.finance.subscriptions.update.mutate({ id, name: name.trim(), amount });
		subscriptionsList.value = subscriptionsList.value.map((s) =>
			s.id === id ? { ...s, name: name.trim(), amount } : s
		);
	}

	async function removeSubscription(id: string): Promise<void> {
		await trpc.finance.subscriptions.delete.mutate({ id });
		subscriptionsList.value = subscriptionsList.value.filter((s) => s.id !== id);
	}

	return {
		monthKeys,
		monthlyPay,
		resolvedPayByMonth,
		accumulatedByMonth,
		subscriptions,
		totalSubscriptionAmount,
		getMonthPay,
		setMonthPay,
		setMonthPayAndForward,
		formatMonthLabel,
		addSubscription,
		updateSubscription,
		removeSubscription,
	};
}
