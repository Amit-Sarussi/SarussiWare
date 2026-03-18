import { computed } from "vue";
import { trpc } from "../trpc";
import { useFinanceData } from "./useFinanceData";
import { useMonthlyPay } from "./useMonthlyPay";
import { usePiggyBanks } from "./usePiggyBanks";
import { useInvestmentAccounts } from "./useInvestmentAccounts";

export type AccountId = "main" | string;

export interface Transaction {
	id: string;
	dateTime: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	fromId: AccountId | null;
	toId: AccountId | null;
	note?: string;
}

export interface Balances {
	main: number;
	piggyBank: Record<string, number>;
	investmentAccount: Record<string, number>;
}

/** Last moment of the month for monthKey YYYY-MM */
function endOfMonth(monthKey: string): Date {
	const [y, m] = monthKey.split("-").map(Number);
	return new Date(y, m, 0, 23, 59, 59, 999);
}

function monthlyMul(yearlyRate: number): number {
	return Math.pow(1 + yearlyRate / 100, 1 / 12);
}

export function useBalances() {
	const { transactionsList } = useFinanceData();
	const { monthKeys, resolvedPayByMonth, totalSubscriptionAmount } = useMonthlyPay();
	const { piggyBanks } = usePiggyBanks();
	const { investmentAccounts } = useInvestmentAccounts();

	const transactions = computed(() => transactionsList.value);

	async function addTransaction(tx: Omit<Transaction, "id">): Promise<Transaction> {
		const created = await trpc.finance.transactions.create.mutate({
			dateTime: tx.dateTime,
			amount: tx.amount,
			type: tx.type,
			fromId: tx.fromId,
			toId: tx.toId,
			note: tx.note,
		});
		transactionsList.value = [created, ...transactionsList.value];
		return created;
	}

	async function updateTransaction(
		id: string,
		tx: Omit<Transaction, "id">
	): Promise<Transaction> {
		const updated = await trpc.finance.transactions.update.mutate({
			id,
			dateTime: tx.dateTime,
			amount: tx.amount,
			type: tx.type,
			fromId: tx.fromId,
			toId: tx.toId,
			note: tx.note,
		});
		transactionsList.value = transactionsList.value.map((t) =>
			t.id === id ? updated : t
		);
		return updated;
	}

	async function removeTransaction(id: string): Promise<void> {
		await trpc.finance.transactions.delete.mutate({ id });
		transactionsList.value = transactionsList.value.filter((t) => t.id !== id);
	}

	function getBalancesAsOf(cutoffDate: Date): Balances {
		const resolved = resolvedPayByMonth.value;
		const subsPerMonth = totalSubscriptionAmount.value;
		const pigs = piggyBanks.value;
		const invs = investmentAccounts.value;

		let main = 0;
		const piggyBank: Record<string, number> = {};
		const investmentAccount: Record<string, number> = {};
		pigs.forEach((p) => {
			piggyBank[p.id] = 0;
		});
		invs.forEach((i) => {
			investmentAccount[i.id] = 0;
		});

		const totalPiggyPct = pigs.reduce((s, p) => s + p.percentage, 0) / 100;
		const totalInvPct = invs.reduce((s, i) => s + i.percentage, 0) / 100;
		const remainderPct = Math.max(0, 1 - totalPiggyPct - totalInvPct);

		for (const key of monthKeys) {
			if (endOfMonth(key) > cutoffDate) break;
			const grossPay = resolved[key] ?? 0;
			const netPay = Math.max(0, grossPay - subsPerMonth);
			main += netPay * remainderPct;
			for (const p of pigs) {
				piggyBank[p.id] += netPay * (p.percentage / 100);
			}
			for (const inv of invs) {
				const mul = monthlyMul(inv.yearlyRate);
				const contribution = netPay * (inv.percentage / 100);
				investmentAccount[inv.id] = investmentAccount[inv.id] * mul + contribution;
			}
		}

		const cutoffTime = cutoffDate.getTime();
		const sorted = [...transactions.value]
			.filter((t) => new Date(t.dateTime).getTime() <= cutoffTime)
			.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

		function applyTx(t: Transaction): void {
			const amt = t.amount;
			if (t.type === "income" && t.toId) {
				if (t.toId === "main") main += amt;
				else if (piggyBank[t.toId] !== undefined) piggyBank[t.toId] += amt;
				else if (investmentAccount[t.toId] !== undefined) investmentAccount[t.toId] += amt;
			} else if (t.type === "expense" && t.fromId) {
				if (t.fromId === "main") main -= amt;
				else if (piggyBank[t.fromId] !== undefined) piggyBank[t.fromId] -= amt;
				else if (investmentAccount[t.fromId] !== undefined) investmentAccount[t.fromId] -= amt;
			} else if (t.type === "transfer" && t.fromId && t.toId) {
				if (t.fromId === "main") main -= amt;
				else if (piggyBank[t.fromId] !== undefined) piggyBank[t.fromId] -= amt;
				else if (investmentAccount[t.fromId] !== undefined) investmentAccount[t.fromId] -= amt;
				if (t.toId === "main") main += amt;
				else if (piggyBank[t.toId] !== undefined) piggyBank[t.toId] += amt;
				else if (investmentAccount[t.toId] !== undefined) investmentAccount[t.toId] += amt;
			}
		}
		sorted.forEach(applyTx);

		return { main, piggyBank, investmentAccount };
	}

	const currentMonthKey = computed(() => {
		const d = new Date();
		const y = d.getFullYear();
		const m = d.getMonth() + 1;
		return `${y}-${String(m).padStart(2, "0")}`;
	});

	const endOfCurrentMonth = computed(() => endOfMonth(monthKeys[0] ?? currentMonthKey.value));

	const balancesNow = computed(() => getBalancesAsOf(new Date()));

	const balancesAfterThisMonth = computed(() => getBalancesAsOf(endOfCurrentMonth.value));

	return {
		transactions,
		addTransaction,
		updateTransaction,
		removeTransaction,
		getBalancesAsOf,
		balancesNow,
		balancesAfterThisMonth,
		endOfCurrentMonth,
		currentMonthKey,
	};
}
