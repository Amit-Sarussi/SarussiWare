import { computed } from "vue";
import { trpc } from "../trpc";
import { useFinanceData } from "./useFinanceData";
import { useMonthlyPay } from "./useMonthlyPay";

export interface PiggyBank {
	id: string;
	name: string;
	percentage: number;
}

export interface PiggyBankGrowthMonth {
	monthKey: string;
	label: string;
	contribution: number;
	accumulated: number;
}

export function usePiggyBanks() {
	const { piggyBanksList } = useFinanceData();
	const { monthKeys, resolvedPayByMonth, totalSubscriptionAmount, formatMonthLabel } = useMonthlyPay();

	const piggyBanks = computed(() => piggyBanksList.value);

	async function addPiggyBank(name: string, percentage: number): Promise<PiggyBank> {
		const row = await trpc.finance.piggyBanks.create.mutate({ name: name.trim(), percentage });
		piggyBanksList.value = [...piggyBanksList.value, row];
		return row;
	}

	async function updatePiggyBank(id: string, name: string, percentage: number): Promise<void> {
		await trpc.finance.piggyBanks.update.mutate({ id, name: name.trim(), percentage });
		piggyBanksList.value = piggyBanksList.value.map((p) =>
			p.id === id ? { ...p, name: name.trim(), percentage } : p
		);
	}

	async function removePiggyBank(id: string): Promise<void> {
		await trpc.finance.piggyBanks.delete.mutate({ id });
		piggyBanksList.value = piggyBanksList.value.filter((p) => p.id !== id);
	}

	function getPiggyBank(id: string): PiggyBank | undefined {
		return piggyBanks.value.find((p) => p.id === id);
	}

	function getGrowth(piggyBankId: string): PiggyBankGrowthMonth[] {
		const piggy = getPiggyBank(piggyBankId);
		const resolved = resolvedPayByMonth.value;
		const subsPerMonth = totalSubscriptionAmount.value;
		if (!piggy) return [];
		const pct = piggy.percentage / 100;
		let accumulated = 0;
		return monthKeys.map((key) => {
			const grossPay = resolved[key] ?? 0;
			const netPay = Math.max(0, grossPay - subsPerMonth);
			const contribution = netPay * pct;
			accumulated += contribution;
			return {
				monthKey: key,
				label: formatMonthLabel(key),
				contribution,
				accumulated,
			};
		});
	}

	return {
		piggyBanks,
		addPiggyBank,
		updatePiggyBank,
		removePiggyBank,
		getPiggyBank,
		getGrowth,
	};
}
