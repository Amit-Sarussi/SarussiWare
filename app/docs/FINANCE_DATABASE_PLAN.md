# Finance feature – database plan

## Principle
**Only persist user input.** All balances, projections, and charts are derived at runtime from pay, subscriptions, allocations, and transactions.

---

## Tables

### 1. `monthly_pay`
Stores the salary amount the user sets per month. “Fill forward” (using the last set value for later months) is done in the app.

| Column     | Type    | Notes                          |
|------------|---------|--------------------------------|
| user_id    | Int     | FK → users.id                  |
| month_key  | String  | `YYYY-MM` (e.g. `2025-03`)     |
| amount     | Decimal | Non-negative, in shekels       |

- **PK:** `(user_id, month_key)`
- **Map in Prisma:** `monthly_pay` (snake_case table name)

---

### 2. `subscriptions`
Monthly subscriptions (name + amount). Subtracted from income each month in calculations.

| Column  | Type    | Notes              |
|---------|---------|--------------------|
| id      | String  | PK, `cuid()`       |
| user_id | Int     | FK → users.id      |
| name    | String  |                    |
| amount  | Decimal | Per month, ≥ 0     |

---

### 3. `piggy_banks`
Piggy bank name and % of net income. Current balance is computed from salary allocations + transactions.

| Column     | Type    | Notes        |
|------------|---------|--------------|
| id         | String  | PK, `cuid()` |
| user_id    | Int     | FK → users.id|
| name       | String  |              |
| percentage | Decimal | 0–100        |

---

### 4. `investment_accounts`
Name, % of net income, and yearly growth rate. Balance is computed (with monthly compounding) from allocations + transactions.

| Column      | Type    | Notes        |
|-------------|---------|--------------|
| id          | String  | PK, `cuid()` |
| user_id     | Int     | FK → users.id|
| name        | String  |              |
| percentage  | Decimal | 0–100        |
| yearly_rate | Decimal | e.g. 5 for 5%|

---

### 5. `transactions`
Income, expense, or transfer with date/time. Drives balance changes; balances are never stored.

| Column   | Type      | Notes                                                                 |
|----------|-----------|-----------------------------------------------------------------------|
| id       | String    | PK, `cuid()`                                                         |
| user_id  | Int       | FK → users.id                                                        |
| date_time| DateTime  | Timestamp (with timezone)                                            |
| amount   | Decimal   | > 0                                                                   |
| type     | Enum      | `income` \| `expense` \| `transfer`                                  |
| from_id  | String?   | `'main'` or `piggy_banks.id` or `investment_accounts.id`; null if income |
| to_id    | String?   | `'main'` or piggy/investment id; null if expense                      |
| note     | String?   | Optional description                                                 |

- **from_id / to_id:** No DB FKs (would require two tables for one column). Validate in API that values are `'main'` or an existing piggy_bank/investment_account id for the user.
- **Map in Prisma:** table name `transactions`.

---

## Not stored (calculated in app)

- **Balances** (main, per piggy bank, per investment account) – from salary splits + transactions up to a given date.
- **Resolved pay by month** – from `monthly_pay` with fill-forward.
- **Net accumulated, growth series, charts** – from pay, subscriptions, %, rates, and transactions.

---

## Prisma schema changes (summary)

- Add 5 models: `MonthlyPay`, `Subscription`, `PiggyBank`, `InvestmentAccount`, `Transaction`.
- All scoped by `userId`; use `protectedProcedure` and `ctx.user.id` for all finance routes.
- Use `Decimal` for money and percentages (Prisma `Decimal`, map to `Decimal` in JS or use `Decimal.toNumber()` where needed).

---

## API (tRPC) – new router `finance`

- **monthlyPay**
  - `list` – return all rows for user (month_key, amount).
  - `set` – upsert one month: `{ monthKey, amount }`.
  - `setForward` – set from a month key onward (multiple upserts).

- **subscriptions**
  - `list`, `create` `{ name, amount }`, `update` `{ id, name?, amount? }`, `delete` `{ id }`.

- **piggyBanks**
  - `list`, `create` `{ name, percentage }`, `update` `{ id, name?, percentage? }`, `delete` `{ id }`.

- **investmentAccounts**
  - `list`, `create` `{ name, percentage, yearlyRate }`, `update` `{ id, name?, percentage?, yearlyRate? }`, `delete` `{ id }`.

- **transactions**
  - `list` – all for user, ordered by date_time desc.
  - `create` – `{ dateTime, amount, type, fromId?, toId?, note? }` with validation.
  - `delete` – `{ id }`.

All mutations validate that the entity belongs to the current user (and for transactions that from_id/to_id are `'main'` or the user’s piggy/investment ids).

---

## Frontend changes (after DB is in place)

1. **Composables** (`useMonthlyPay`, `usePiggyBanks`, `useInvestmentAccounts`, `useBalances`):
   - Replace in-memory `ref` state with:
     - Either fetch once on mount and keep local state, syncing with server on each mutation (refetch or update local state from mutation result), or
     - Use tRPC queries (e.g. `useQuery`) so list data comes from the server and cache is invalidated on mutations.
   - Call the new tRPC procedures for all reads and writes.

2. **IDs:** Use server-generated `cuid()` for new subscriptions, piggy banks, investment accounts, and transactions. The app currently uses client-generated ids (`sub-xxx`, `pb-xxx`, etc.); after migration, creation will return the new id from the API and the client will use it.

3. **Transactions:** Send `dateTime` as ISO string; server will parse to `DateTime`. Store and return `from_id` / `to_id` as `'main'` or the cuid string.

4. **Monthly pay:** API can return a list of `{ monthKey, amount }`; the client still builds the 24-month window and fill-forward logic from this list.

---

## Migration

- Add a Prisma migration for the 5 new tables.
- No backfill needed (new feature). Existing in-memory state is lost on refresh until the frontend is wired to the API; no data migration from existing storage.

---

## File changes (implementation order)

1. **prisma/schema.prisma** – Add 5 models and enums.
2. **Migration** – `npx prisma migrate dev --name add_finance_tables` (or equivalent).
3. **server/trpc/routers/finance.ts** – New router with the procedures above.
4. **server/trpc/routers/index.ts** – Register `finance` router.
5. **Composables** – Switch to tRPC: load from API, mutate via API, keep same public interface where possible so views need minimal changes.
6. **Views** – Only adjust if composable signatures change (e.g. if we need to pass in `userId`; currently auth is global so `protectedProcedure` + `ctx.user.id` is enough).

If this plan looks good, next step is implementing the schema, migration, and finance router, then wiring the composables to the API.
