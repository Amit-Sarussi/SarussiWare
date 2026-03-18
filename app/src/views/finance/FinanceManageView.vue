<script setup lang="ts">
</script>

<template>
	<div class="cider cider-fixed max-w-2xl">
		<h1>Manage</h1>
		<p class="text-tertiary-foreground text-[15px] mt-1">
			Manage your finance settings and forecasts.
		</p>

		<div class="grid gap-4 mt-6 sm:grid-cols-2">
			<router-link
				:to="{ name: 'finance-manage-pay' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Manage pay</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Set your expected monthly pay for the next 24 months.
				</p>
			</router-link>
			<router-link
				:to="{ name: 'finance-manage-subscriptions' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Manage subscriptions</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Add monthly subscriptions that are subtracted from your income.
				</p>
			</router-link>
			<router-link
				:to="{ name: 'finance-manage-piggy-banks' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Manage piggy banks</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Create piggy banks and set what % of your net income goes to each.
				</p>
			</router-link>
			<router-link
				:to="{ name: 'finance-manage-investment-accounts' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Manage investment accounts</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Like piggy banks with a yearly growth rate; balance compounds monthly.
				</p>
			</router-link>
			<router-link
				:to="{ name: 'finance-manage-debts' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Manage debts</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Track debts by name and total amount; record payments as transfers to report progress.
				</p>
			</router-link>
			<router-link
				:to="{ name: 'finance-manage-transactions' }"
				class="card flex flex-col min-h-24 p-5 no-underline text-inherit hover:bg-(--color-panel-hover)">
				<span class="text-[17px] font-semibold">Transactions</span>
				<p class="text-[15px] text-tertiary-foreground mt-1">
					Add income, expenses, or transfers between Balance and accounts.
				</p>
			</router-link>
		</div>
	</div>
</template>

<style scoped>
</style>
