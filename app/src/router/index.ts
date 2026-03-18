import { createRouter, createWebHistory } from "vue-router";
import { useAuth, authGuardPending } from "../composables/useAuth";
import { useFinanceData } from "../composables/useFinanceData";
import MainLayout from "../layouts/MainLayout.vue";
import WelcomeView from "../views/home/WelcomeView.vue";
import SystemSettingsView from "../views/system/SystemSettingsView.vue";
import AccountSettingsView from "../views/account/AccountSettingsView.vue";
import FinanceOverviewView from "../views/finance/FinanceOverviewView.vue";
import FinanceManageView from "../views/finance/FinanceManageView.vue";
import FinanceManagePayView from "../views/finance/FinanceManagePayView.vue";
import FinanceManageSubscriptionsView from "../views/finance/FinanceManageSubscriptionsView.vue";
import FinanceManagePiggyBanksView from "../views/finance/FinanceManagePiggyBanksView.vue";
import FinancePiggyBankDetailView from "../views/finance/FinancePiggyBankDetailView.vue";
import FinanceManageInvestmentAccountsView from "../views/finance/FinanceManageInvestmentAccountsView.vue";
import FinanceInvestmentAccountDetailView from "../views/finance/FinanceInvestmentAccountDetailView.vue";
import FinanceManageDebtsView from "../views/finance/FinanceManageDebtsView.vue";
import FinanceManageTransactionsView from "../views/finance/FinanceManageTransactionsView.vue";
import LoginView from "../views/auth/LoginView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", name: "home", component: WelcomeView },
        { path: "system-settings", name: "system-settings", component: SystemSettingsView },
        { path: "account-settings", name: "account-settings", component: AccountSettingsView },
        { path: "finance/overview", name: "finance-overview", component: FinanceOverviewView },
        { path: "finance/manage", name: "finance-manage", component: FinanceManageView },
        { path: "finance/manage/pay", name: "finance-manage-pay", component: FinanceManagePayView },
        { path: "finance/manage/subscriptions", name: "finance-manage-subscriptions", component: FinanceManageSubscriptionsView },
        { path: "finance/manage/piggy-banks", name: "finance-manage-piggy-banks", component: FinanceManagePiggyBanksView },
        { path: "finance/piggy-banks/:id", name: "finance-piggy-bank-detail", component: FinancePiggyBankDetailView },
        { path: "finance/manage/investment-accounts", name: "finance-manage-investment-accounts", component: FinanceManageInvestmentAccountsView },
        { path: "finance/investment-accounts/:id", name: "finance-investment-account-detail", component: FinanceInvestmentAccountDetailView },
        { path: "finance/manage/debts", name: "finance-manage-debts", component: FinanceManageDebtsView },
        { path: "finance/manage/transactions", name: "finance-manage-transactions", component: FinanceManageTransactionsView },
      ],
    },
    { path: "/login", name: "login", component: LoginView },
  ],
});

router.beforeEach(async (to, from) => {
  const { fetchMe, isLoggedIn, loaded } = useAuth();

  if (loaded.value) {
    // Already have auth state — resolve immediately, no loading
    if (to.path === "/login") {
      if (isLoggedIn.value) return { path: "/" };
      return true;
    }
    if (!isLoggedIn.value) return { path: "/login" };
    if (to.path === "/system-settings") {
      const { user } = useAuth();
      if (!user.value?.permissions?.includes("admin")) return { path: "/" };
    }
    if (to.path.startsWith("/finance")) {
      const { user } = useAuth();
      const canFinance =
        user.value?.permissions?.includes("finance") || user.value?.permissions?.includes("admin");
      if (!canFinance) return { path: "/" };
    }
    // Load finance data only once when entering finance (skip when already on a finance page)
    if (to.path.startsWith("/finance") && !from.path.startsWith("/finance")) {
      const { load } = useFinanceData();
      await load();
    }
    return true;
  }

  // First load: fetch user and show loading until we know
  authGuardPending.value = true;
  try {
    await fetchMe();
    if (to.path === "/login") {
      if (isLoggedIn.value) return { path: "/" };
      return true;
    }
    if (!isLoggedIn.value) return { path: "/login" };
    if (to.path === "/system-settings") {
      const { user } = useAuth();
      if (!user.value?.permissions?.includes("admin")) return { path: "/" };
    }
    if (to.path.startsWith("/finance")) {
      const { user } = useAuth();
      const canFinance =
        user.value?.permissions?.includes("finance") || user.value?.permissions?.includes("admin");
      if (!canFinance) return { path: "/" };
    }
    // Load finance data only once when entering finance (cache for all sub-navigation)
    if (to.path.startsWith("/finance") && !from.path.startsWith("/finance")) {
      const { load } = useFinanceData();
      await load();
    }
    return true;
  } finally {
    authGuardPending.value = false;
  }
});

export default router;
