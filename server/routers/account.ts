import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomInt } from "crypto";


function generateAccountNumber(): string {
  return randomInt(0, 1000000000).toString().padStart(10, "0");
}

export const accountRouter = router({
  createAccount: protectedProcedure
    .input(
      z.object({
        accountType: z.enum(["checking", "savings"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already has an account of this type
      const existingAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.accountType, input.accountType)))
        .get();

      if (existingAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a ${input.accountType} account`,
        });
      }

      let accountNumber;
      let isUnique = false;

      // Generate unique account number
      while (!isUnique) {
        accountNumber = generateAccountNumber();
        const existing = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
        isUnique = !existing;
      }

      await db.insert(accounts).values({
        userId: ctx.user.id,
        accountNumber: accountNumber!,
        accountType: input.accountType,
        balance: 0,
        status: "active",
      });

      // Fetch the created account
      const account = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber!)).get();

      return account
        ? { ...account, balance: account.balance / 100 }
        : {
          id: 0,
          userId: ctx.user.id,
          accountNumber: accountNumber!,
          accountType: input.accountType,
          balance: 0,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
    }),

  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts.map(acc => ({
      ...acc,
      balance: acc.balance / 100
    }));
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive(),
        fundingSource: z.object({
          type: z.enum(["card", "bank"]),
          accountNumber: z.string(),
          routingNumber: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const amount = parseFloat(input.amount.toString());

      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account is not active",
        });
      }

      // Create transaction
      // Convert amount to cents
      const amountInCents = Math.round(amount * 100);

      const [transaction] = await db.insert(transactions).values({
        accountId: input.accountId,
        type: "deposit",
        amount: amountInCents,
        description: `Funding from ${input.fundingSource.type}`,
        status: "completed",
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      }).returning();

      // Update account balance atomically
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${amountInCents}`,
        })
        .where(eq(accounts.id, input.accountId));

      // Fetch updated account to get the new balance for return
      const updatedAccount = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();

      return {
        transaction: {
          ...transaction,
          amount: transaction.amount / 100
        },
        newBalance: updatedAccount ? updatedAccount.balance / 100 : 0,
      };
    }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(desc(transactions.createdAt), desc(transactions.id));

      return accountTransactions.map(tx => ({
        ...tx,
        amount: tx.amount / 100,
        accountType: account.accountType,
      }));
    }),
});
