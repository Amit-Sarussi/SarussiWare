import { computed } from "vue";
import { trpc } from "../trpc";
import { useFinanceData } from "./useFinanceData";

export interface Debt {
	id: string;
	name: string;
	totalAmount: number;
}

export function useDebts() {
	const { debtsList, transactionsList } = useFinanceData();

	const debts = computed(() => debtsList.value);

	async function addDebt(name: string, totalAmount: number): Promise<Debt> {
		const row = await trpc.finance.debts.create.mutate({
			name: name.trim(),
			totalAmount,
		});
		debtsList.value = [...debtsList.value, row];
		return row;
	}

	async function updateDebt(
		id: string,
		updates: { name?: string; totalAmount?: number }
	): Promise<void> {
		await trpc.finance.debts.update.mutate({ id, ...updates });
		debtsList.value = debtsList.value.map((d) =>
			d.id === id ? { ...d, ...updates, name: updates.name ?? d.name, totalAmount: updates.totalAmount ?? d.totalAmount } : d
		);
	}

	async function removeDebt(id: string): Promise<void> {
		await trpc.finance.debts.delete.mutate({ id });
		debtsList.value = debtsList.value.filter((d) => d.id !== id);
	}

	function getDebt(id: string): Debt | undefined {
		return debts.value.find((d) => d.id === id);
	}

	/** Sum of transfer amounts to this debt up to cutoff (default: now) */
	function getPaidToDebt(debtId: string, cutoffDate?: Date): number {
		const cutoff = cutoffDate ? cutoffDate.getTime() : Date.now();
		return transactionsList.value
			.filter(
				(t) =>
					t.type === "transfer" &&
					t.toId === debtId &&
					new Date(t.dateTime).getTime() <= cutoff
			)
			.reduce((sum, t) => sum + t.amount, 0);
	}

	/** Date when the debt was paid off (first moment paid >= totalAmount), or undefined if not completed */
	function getDebtCompletedDate(debtId: string, totalAmount: number): string | undefined {
		const payments = transactionsList.value
			.filter((t) => t.type === "transfer" && t.toId === debtId)
			.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
		let sum = 0;
		for (const t of payments) {
			sum += t.amount;
			if (sum >= totalAmount) return t.dateTime;
		}
		return undefined;
	}

	return {
		debts,
		addDebt,
		updateDebt,
		removeDebt,
		getDebt,
		getPaidToDebt,
		getDebtCompletedDate,
	};
}
