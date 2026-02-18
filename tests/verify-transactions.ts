
import 'dotenv/config';
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyTransactions() {
    console.log("Starting transaction verification script...");

    // 1. Create a test user
    const timestamp = Date.now();
    const testUser = {
        email: `test-tx-${timestamp}@example.com`,
        password: "Password123!",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        ssn: `ssn-${timestamp}`,
        address: "123 Test St",
        city: "Test City",
        state: "CA",
        zipCode: "12345",
    };

    const insertedUser = await db.insert(users).values(testUser).returning().get();
    console.log(`Created test user with ID: ${insertedUser.id}`);

    // 2. Create Context
    const ctx = {
        req: { headers: { get: () => "" } },
        res: {
            setHeader: (key: string, val: string) => { },
            set: (key: string, val: string) => { }
        },
        user: { id: insertedUser.id },
    };

    const createCaller = createCallerFactory(accountRouter);
    const caller = createCaller(ctx as any);

    // 3. Create an account
    const account = await caller.createAccount({ accountType: "checking" });
    console.log(`Created account: ${account.accountNumber}`);

    // 4. Fund account multiple times
    const fundingAmounts = [10, 20, 30];

    console.log("Funding account...");
    for (const amount of fundingAmounts) {
        await caller.fundAccount({
            accountId: account.id,
            amount: amount,
            fundingSource: {
                type: "bank",
                accountNumber: "1234567890"
            }
        });
        // Small delay to ensure createdAt differs (SQLite resolution might be low, but Date().toISOString() is used)
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }

    // 5. Fetch transactions
    console.log("Fetching transactions...");
    const txs = await caller.getTransactions({ accountId: account.id });

    console.log(`Fetched ${txs.length} transactions.`);

    // 6. Verify assertions
    try {
        // Assert Count
        if (txs.length !== 3) {
            throw new Error(`Expected 3 transactions, got ${txs.length}`);
        }

        // Assert Order (Newest first)
        // txs[0] should be the last one funded ($30)
        if (txs[0].amount !== 30) {
            throw new Error(`Expected newest transaction to be 30, got ${txs[0].amount}`);
        }
        if (txs[1].amount !== 20) {
            throw new Error(`Expected middle transaction to be 20, got ${txs[1].amount}`);
        }
        if (txs[2].amount !== 10) {
            throw new Error(`Expected oldest transaction to be 10, got ${txs[2].amount}`);
        }

        // Verify Date Order
        const d0 = new Date(txs[0].createdAt!);
        const d1 = new Date(txs[1].createdAt!);
        const d2 = new Date(txs[2].createdAt!);

        if (d0 < d1 || d1 < d2) {
            throw new Error(`Transactions are not sorted by date descending: ${txs.map(t => t.createdAt).join(', ')}`);
        }

        console.log("SUCCESS: Transactions are correct and sorted.");

    } catch (e: any) {
        console.error("FAIL: Verification failed.", e.message);
        console.log("Transactions:", JSON.stringify(txs, null, 2));
        process.exit(1);
    } finally {
        // Cleanup
        console.log("Cleaning up...");
        await db.delete(transactions).where(eq(transactions.accountId, account.id));
        await db.delete(accounts).where(eq(accounts.id, account.id));
        await db.delete(users).where(eq(users.id, insertedUser.id));
    }
}

verifyTransactions().catch(console.error);
