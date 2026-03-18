import { ref, type Ref } from "vue";
import { trpc } from "../trpc";

export interface MonthlyPayRow {
	monthKey: string;
	amount: number;
}

export interface SubscriptionRow {
	id: string;
	name: string;
	amount: number;
}

export interface PiggyBankRow {
	id: string;
	name: string;
	percentage: number;
}

export interface InvestmentAccountRow {
	id: string;
	name: string;
	percentage: number;
	yearlyRate: number;
}

export interface DebtRow {
	id: string;
	name: string;
	totalAmount: number;
}

export interface TransactionRow {
	id: string;
	dateTime: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	fromId: string | null;
	toId: string | null;
	note?: string;
}

const monthlyPayList: Ref<MonthlyPayRow[]> = ref([]);
const subscriptionsList: Ref<SubscriptionRow[]> = ref([]);
const piggyBanksList: Ref<PiggyBankRow[]> = ref([]);
const investmentAccountsList: Ref<InvestmentAccountRow[]> = ref([]);
const debtsList: Ref<DebtRow[]> = ref([]);
const transactionsList: Ref<TransactionRow[]> = ref([]);

let loadPromise: Promise<void> | null = null;

export function useFinanceData() {
	async function load(): Promise<void> {
		const p =
			loadPromise ??
			(loadPromise = trpc.finance.getAll.query().then((data) => {
				monthlyPayList.value = data.monthlyPay;
				subscriptionsList.value = data.subscriptions;
				piggyBanksList.value = data.piggyBanks;
				investmentAccountsList.value = data.investmentAccounts;
				debtsList.value = data.debts;
				transactionsList.value = data.transactions;
			}));
		await p;
		loadPromise = null;
	}

	return {
		monthlyPayList,
		subscriptionsList,
		piggyBanksList,
		investmentAccountsList,
		debtsList,
		transactionsList,
		load,
	};
}
