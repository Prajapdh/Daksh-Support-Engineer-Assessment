
import 'dotenv/config';
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Starting reproduction script...");

    // 1. Create a test user
    const testUserEmail = `test-balance-${Date.now()}@example.com`;
    const testUser = {
        email: testUserEmail,
        password: "Password123!",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        ssn: "123456789",
        address: "123 Test St",
        city: "Test City",
        state: "CA",
        zipCode: "12345",
    };

    const insertedUser = await db.insert(users).values(testUser).returning().get();
    console.log(`Created test user with ID: ${insertedUser.id}`);

    // 2. Create Context with the user
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
    console.log(`Created account: ${account.accountNumber} with balance: ${account.balance}`);

    // 4. Perform multiple strictly floating point transactions
    // 0.1 + 0.2 is the classic example where it equals 0.30000000000000004
    const amounts = [0.1, 0.2];
    const expectedTotal = 0.3;

    // We will do this 10 times to accumulate error
    let runningTotal = 0;

    console.log("Performing transactions...");
    for (let i = 0; i < 10; i++) {
        for (const amount of amounts) {
            await caller.fundAccount({
                accountId: account.id,
                amount: amount,
                fundingSource: {
                    type: "bank",
                    accountNumber: "1234567890"
                }
            });
            runningTotal += amount;
        }
    }

    console.log(`Total deposited: ${runningTotal}`);

    // 5. Check balance in DB
    const dbAccount = await db.select().from(accounts).where(eq(accounts.id, account.id)).get();

    if (!dbAccount) {
        console.error("Account not found!");
        process.exit(1);
    }

    console.log(`Final DB Balance: ${dbAccount.balance}`);

    // Expected balance is 300 cents (3.0 * 100)

    const expected = 300;
    if (dbAccount.balance !== expected) {
        console.error(`FAIL: Balance mismatch! Expected ${expected}, got ${dbAccount.balance}`);
        console.error(`Difference: ${Math.abs(dbAccount.balance - expected)}`);

        // Clean up
        await db.delete(transactions).where(eq(transactions.accountId, account.id));
        await db.delete(accounts).where(eq(accounts.id, account.id));
        await db.delete(users).where(eq(users.id, insertedUser.id));

        process.exit(1);
    } else {
        console.log("SUCCESS: Balance matches expectations.");
        // Clean up
        await db.delete(transactions).where(eq(transactions.accountId, account.id));
        await db.delete(accounts).where(eq(accounts.id, account.id));
        await db.delete(users).where(eq(users.id, insertedUser.id));
    }
}

main().catch(console.error);
