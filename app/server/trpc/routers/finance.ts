import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../../db.js";
import { router, protectedProcedure } from "../trpc.js";

function toNum(d: unknown): number {
	return Number(d);
}

export const financeRouter = router({
	/** Load all finance data in one call (for initial load / refetch) */
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.user!.id;
		const [monthlyPayRows, subs, pigs, invs, txRows] = await Promise.all([
			prisma.monthlyPay.findMany({ where: { userId }, orderBy: { monthKey: "asc" } }),
			prisma.subscription.findMany({ where: { userId }, orderBy: { name: "asc" } }),
			prisma.piggyBank.findMany({ where: { userId }, orderBy: { name: "asc" } }),
			prisma.investmentAccount.findMany({ where: { userId }, orderBy: { name: "asc" } }),
			prisma.transaction.findMany({ where: { userId }, orderBy: { dateTime: "desc" } }),
		]);
		return {
			monthlyPay: monthlyPayRows.map((r) => ({ monthKey: r.monthKey, amount: toNum(r.amount) })),
			subscriptions: subs.map((r) => ({ id: r.id, name: r.name, amount: toNum(r.amount) })),
			piggyBanks: pigs.map((r) => ({ id: r.id, name: r.name, percentage: toNum(r.percentage) })),
			investmentAccounts: invs.map((r) => ({
				id: r.id,
				name: r.name,
				percentage: toNum(r.percentage),
				yearlyRate: toNum(r.yearlyRate),
			})),
			transactions: txRows.map((r) => ({
				id: r.id,
				dateTime: r.dateTime.toISOString(),
				amount: toNum(r.amount),
				type: r.type as "income" | "expense" | "transfer",
				fromId: r.fromId,
				toId: r.toId,
				note: r.note ?? undefined,
			})),
		};
	}),

	// --- Monthly pay ---
	monthlyPay: {
		list: protectedProcedure.query(async ({ ctx }) => {
			const rows = await prisma.monthlyPay.findMany({
				where: { userId: ctx.user!.id },
				orderBy: { monthKey: "asc" },
			});
			return rows.map((r) => ({ monthKey: r.monthKey, amount: toNum(r.amount) }));
		}),

		set: protectedProcedure
			.input(z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/), amount: z.number().min(0) }))
			.mutation(async ({ ctx, input }) => {
				await prisma.monthlyPay.upsert({
					where: {
						userId_monthKey: { userId: ctx.user!.id, monthKey: input.monthKey },
					},
					create: {
						userId: ctx.user!.id,
						monthKey: input.monthKey,
						amount: input.amount,
					},
					update: { amount: input.amount },
				});
				return { ok: true };
			}),

		setForward: protectedProcedure
			.input(z.object({ fromMonthKey: z.string().regex(/^\d{4}-\d{2}$/), amount: z.number().min(0) }))
			.mutation(async ({ ctx, input }) => {
				// Build next 24 month keys from current month
				const keys: string[] = [];
				const d = new Date();
				for (let i = 0; i < 24; i++) {
					const y = d.getFullYear();
					const m = d.getMonth() + 1;
					keys.push(`${y}-${String(m).padStart(2, "0")}`);
					d.setMonth(d.getMonth() + 1);
				}
				const idx = keys.indexOf(input.fromMonthKey);
				if (idx === -1) {
					// fromMonthKey not in window: just upsert it
					await prisma.monthlyPay.upsert({
						where: {
							userId_monthKey: { userId: ctx.user!.id, monthKey: input.fromMonthKey },
						},
						create: {
							userId: ctx.user!.id,
							monthKey: input.fromMonthKey,
							amount: input.amount,
						},
						update: { amount: input.amount },
					});
					return { ok: true };
				}
				for (let i = idx; i < keys.length; i++) {
					const key = keys[i];
					await prisma.monthlyPay.upsert({
						where: {
							userId_monthKey: { userId: ctx.user!.id, monthKey: key },
						},
						create: {
							userId: ctx.user!.id,
							monthKey: key,
							amount: input.amount,
						},
						update: { amount: input.amount },
					});
				}
				return { ok: true };
			}),
	},

	// --- Subscriptions ---
	subscriptions: {
		list: protectedProcedure.query(async ({ ctx }) => {
			const rows = await prisma.subscription.findMany({
				where: { userId: ctx.user!.id },
				orderBy: { name: "asc" },
			});
			return rows.map((r) => ({
				id: r.id,
				name: r.name,
				amount: toNum(r.amount),
			}));
		}),

		create: protectedProcedure
			.input(z.object({ name: z.string().min(1), amount: z.number().min(0) }))
			.mutation(async ({ ctx, input }) => {
				const sub = await prisma.subscription.create({
					data: {
						userId: ctx.user!.id,
						name: input.name.trim(),
						amount: (input.amount),
					},
				});
				return { id: sub.id, name: sub.name, amount: toNum(sub.amount) };
			}),

		update: protectedProcedure
			.input(
				z.object({
					id: z.string().min(1),
					name: z.string().min(1).optional(),
					amount: z.number().min(0).optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.subscription.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
				}
				const data: { name?: string; amount?: number } = {};
				if (input.name !== undefined) data.name = input.name.trim();
				if (input.amount !== undefined) data.amount = input.amount;
				const sub = await prisma.subscription.update({
					where: { id: input.id },
					data,
				});
				return { id: sub.id, name: sub.name, amount: toNum(sub.amount) };
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string().min(1) }))
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.subscription.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
				}
				await prisma.subscription.delete({ where: { id: input.id } });
				return { ok: true };
			}),
	},

	// --- Piggy banks ---
	piggyBanks: {
		list: protectedProcedure.query(async ({ ctx }) => {
			const rows = await prisma.piggyBank.findMany({
				where: { userId: ctx.user!.id },
				orderBy: { name: "asc" },
			});
			return rows.map((r) => ({
				id: r.id,
				name: r.name,
				percentage: toNum(r.percentage),
			}));
		}),

		create: protectedProcedure
			.input(z.object({ name: z.string().min(1), percentage: z.number().min(0).max(100) }))
			.mutation(async ({ ctx, input }) => {
				const row = await prisma.piggyBank.create({
					data: {
						userId: ctx.user!.id,
						name: input.name.trim(),
						percentage: input.percentage,
					},
				});
				return { id: row.id, name: row.name, percentage: toNum(row.percentage) };
			}),

		update: protectedProcedure
			.input(
				z.object({
					id: z.string().min(1),
					name: z.string().min(1).optional(),
					percentage: z.number().min(0).max(100).optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.piggyBank.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Piggy bank not found" });
				}
				const data: { name?: string; percentage?: number } = {};
				if (input.name !== undefined) data.name = input.name.trim();
				if (input.percentage !== undefined) data.percentage = input.percentage;
				const row = await prisma.piggyBank.update({
					where: { id: input.id },
					data,
				});
				return { id: row.id, name: row.name, percentage: toNum(row.percentage) };
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string().min(1) }))
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.piggyBank.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Piggy bank not found" });
				}
				await prisma.piggyBank.delete({ where: { id: input.id } });
				return { ok: true };
			}),
	},

	// --- Investment accounts ---
	investmentAccounts: {
		list: protectedProcedure.query(async ({ ctx }) => {
			const rows = await prisma.investmentAccount.findMany({
				where: { userId: ctx.user!.id },
				orderBy: { name: "asc" },
			});
			return rows.map((r) => ({
				id: r.id,
				name: r.name,
				percentage: toNum(r.percentage),
				yearlyRate: toNum(r.yearlyRate),
			}));
		}),

		create: protectedProcedure
			.input(
				z.object({
					name: z.string().min(1),
					percentage: z.number().min(0).max(100),
					yearlyRate: z.number(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const row = await prisma.investmentAccount.create({
					data: {
						userId: ctx.user!.id,
						name: input.name.trim(),
						percentage: input.percentage,
						yearlyRate: input.yearlyRate,
					},
				});
				return {
					id: row.id,
					name: row.name,
					percentage: toNum(row.percentage),
					yearlyRate: toNum(row.yearlyRate),
				};
			}),

		update: protectedProcedure
			.input(
				z.object({
					id: z.string().min(1),
					name: z.string().min(1).optional(),
					percentage: z.number().min(0).max(100).optional(),
					yearlyRate: z.number().optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.investmentAccount.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Investment account not found" });
				}
				const data: { name?: string; percentage?: number; yearlyRate?: number } = {};
				if (input.name !== undefined) data.name = input.name.trim();
				if (input.percentage !== undefined) data.percentage = input.percentage;
				if (input.yearlyRate !== undefined) data.yearlyRate = input.yearlyRate;
				const row = await prisma.investmentAccount.update({
					where: { id: input.id },
					data,
				});
				return {
					id: row.id,
					name: row.name,
					percentage: toNum(row.percentage),
					yearlyRate: toNum(row.yearlyRate),
				};
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string().min(1) }))
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.investmentAccount.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Investment account not found" });
				}
				await prisma.investmentAccount.delete({ where: { id: input.id } });
				return { ok: true };
			}),
	},

	// --- Transactions ---
	transactions: {
		list: protectedProcedure.query(async ({ ctx }) => {
			const rows = await prisma.transaction.findMany({
				where: { userId: ctx.user!.id },
				orderBy: { dateTime: "desc" },
			});
			return rows.map((r) => ({
				id: r.id,
				dateTime: r.dateTime.toISOString(),
				amount: toNum(r.amount),
				type: r.type as "income" | "expense" | "transfer",
				fromId: r.fromId,
				toId: r.toId,
				note: r.note ?? undefined,
			}));
		}),

		create: protectedProcedure
			.input(
				z.object({
					dateTime: z.string().datetime(),
					amount: z.number().positive(),
					type: z.enum(["income", "expense", "transfer"]),
					fromId: z.string().nullable(),
					toId: z.string().nullable(),
					note: z.string().optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const userId = ctx.user!.id;
				// Validate fromId / toId: must be 'main' or a valid piggy/investment id for this user
				const piggyIds = (await prisma.piggyBank.findMany({ where: { userId }, select: { id: true } })).map(
					(p) => p.id
				);
				const invIds = (
					await prisma.investmentAccount.findMany({ where: { userId }, select: { id: true } })
				).map((i) => i.id);
				const validAccountIds = new Set([...piggyIds, ...invIds]);

				function validId(id: string | null): boolean {
					if (id === null) return true;
					if (id === "main") return true;
					return validAccountIds.has(id);
				}

				if (input.type === "income") {
					if (input.fromId != null) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Income must not have fromId" });
					}
					if (!input.toId || (input.toId !== "main" && !validAccountIds.has(input.toId))) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid toId for income" });
					}
				} else if (input.type === "expense") {
					if (input.toId != null) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Expense must not have toId" });
					}
					if (!input.fromId || (input.fromId !== "main" && !validAccountIds.has(input.fromId))) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid fromId for expense" });
					}
				} else {
					if (!validId(input.fromId) || !validId(input.toId) || input.fromId === input.toId) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid fromId or toId for transfer" });
					}
				}

				const tx = await prisma.transaction.create({
					data: {
						userId,
						dateTime: new Date(input.dateTime),
						amount: (input.amount),
						type: input.type,
						fromId: input.fromId ?? undefined,
						toId: input.toId ?? undefined,
						note: input.note?.trim() || undefined,
					},
				});
				return {
					id: tx.id,
					dateTime: tx.dateTime.toISOString(),
					amount: toNum(tx.amount),
					type: tx.type as "income" | "expense" | "transfer",
					fromId: tx.fromId,
					toId: tx.toId,
					note: tx.note ?? undefined,
				};
			}),

		update: protectedProcedure
			.input(
				z.object({
					id: z.string().min(1),
					dateTime: z.string().datetime(),
					amount: z.number().positive(),
					type: z.enum(["income", "expense", "transfer"]),
					fromId: z.string().nullable(),
					toId: z.string().nullable(),
					note: z.string().optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.transaction.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
				}
				const userId = ctx.user!.id;
				const piggyIds = (await prisma.piggyBank.findMany({ where: { userId }, select: { id: true } })).map(
					(p) => p.id
				);
				const invIds = (
					await prisma.investmentAccount.findMany({ where: { userId }, select: { id: true } })
				).map((i) => i.id);
				const validAccountIds = new Set([...piggyIds, ...invIds]);

				function validId(id: string | null): boolean {
					if (id === null) return true;
					if (id === "main") return true;
					return validAccountIds.has(id);
				}

				if (input.type === "income") {
					if (input.fromId != null) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Income must not have fromId" });
					}
					if (!input.toId || (input.toId !== "main" && !validAccountIds.has(input.toId))) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid toId for income" });
					}
				} else if (input.type === "expense") {
					if (input.toId != null) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Expense must not have toId" });
					}
					if (!input.fromId || (input.fromId !== "main" && !validAccountIds.has(input.fromId))) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid fromId for expense" });
					}
				} else {
					if (!validId(input.fromId) || !validId(input.toId) || input.fromId === input.toId) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid fromId or toId for transfer" });
					}
				}

				const tx = await prisma.transaction.update({
					where: { id: input.id },
					data: {
						dateTime: new Date(input.dateTime),
						amount: input.amount,
						type: input.type,
						fromId: input.fromId ?? undefined,
						toId: input.toId ?? undefined,
						note: input.note?.trim() || undefined,
					},
				});
				return {
					id: tx.id,
					dateTime: tx.dateTime.toISOString(),
					amount: toNum(tx.amount),
					type: tx.type as "income" | "expense" | "transfer",
					fromId: tx.fromId,
					toId: tx.toId,
					note: tx.note ?? undefined,
				};
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string().min(1) }))
			.mutation(async ({ ctx, input }) => {
				const existing = await prisma.transaction.findFirst({
					where: { id: input.id, userId: ctx.user!.id },
				});
				if (!existing) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
				}
				await prisma.transaction.delete({ where: { id: input.id } });
				return { ok: true };
			}),
	},
});
