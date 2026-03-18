import { computed } from "vue";
import { trpc } from "../trpc";
import { useFinanceData } from "./useFinanceData";
import { useMonthlyPay } from "./useMonthlyPay";

export interface InvestmentAccount {
	id: string;
	name: string;
	percentage: number;
	yearlyRate: number;
}

export interface InvestmentGrowthMonth {
	monthKey: string;
	label: string;
	contribution: number;
	accumulated: number;
}

function monthlyMultiplierFromYearlyRate(yearlyRate: number): number {
	return Math.pow(1 + yearlyRate / 100, 1 / 12);
}

export function useInvestmentAccounts() {
	const { investmentAccountsList } = useFinanceData();
	const { monthKeys, resolvedPayByMonth, totalSubscriptionAmount, formatMonthLabel } = useMonthlyPay();

	const investmentAccounts = computed(() => investmentAccountsList.value);

	async function addInvestmentAccount(
		name: string,
		percentage: number,
		yearlyRate: number
	): Promise<InvestmentAccount> {
		const row = await trpc.finance.investmentAccounts.create.mutate({
			name: name.trim(),
			percentage,
			yearlyRate,
		});
		investmentAccountsList.value = [...investmentAccountsList.value, row];
		return row;
	}

	async function updateInvestmentAccount(
		id: string,
		name: string,
		percentage: number,
		yearlyRate: number
	): Promise<void> {
		await trpc.finance.investmentAccounts.update.mutate({
			id,
			name: name.trim(),
			percentage,
			yearlyRate,
		});
		investmentAccountsList.value = investmentAccountsList.value.map((inv) =>
			inv.id === id ? { ...inv, name: name.trim(), percentage, yearlyRate } : inv
		);
	}

	async function removeInvestmentAccount(id: string): Promise<void> {
		await trpc.finance.investmentAccounts.delete.mutate({ id });
		investmentAccountsList.value = investmentAccountsList.value.filter((inv) => inv.id !== id);
	}

	function getInvestmentAccount(id: string): InvestmentAccount | undefined {
		return investmentAccounts.value.find((inv) => inv.id === id);
	}

	function getGrowth(accountId: string): InvestmentGrowthMonth[] {
		const account = getInvestmentAccount(accountId);
		const resolved = resolvedPayByMonth.value;
		const subsPerMonth = totalSubscriptionAmount.value;
		if (!account) return [];
		const pct = account.percentage / 100;
		const monthlyMul = monthlyMultiplierFromYearlyRate(account.yearlyRate);
		let accumulated = 0;
		return monthKeys.map((key) => {
			const grossPay = resolved[key] ?? 0;
			const netPay = Math.max(0, grossPay - subsPerMonth);
			const contribution = netPay * pct;
			accumulated = accumulated * monthlyMul + contribution;
			return {
				monthKey: key,
				label: formatMonthLabel(key),
				contribution,
				accumulated,
			};
		});
	}

	return {
		investmentAccounts,
		addInvestmentAccount,
		updateInvestmentAccount,
		removeInvestmentAccount,
		getInvestmentAccount,
		getGrowth,
		monthlyMultiplierFromYearlyRate,
	};
}
