
import { accountRouter } from "../server/routers/account";
import { db } from "../lib/db";
import { users, accounts, transactions } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyValidCreditCardNumber() {
    console.log("Test Credit Card Number...");

    // Setup: Mock context and user
    const email = `val206.test.${Date.now()}@example.com`;
    const user = await db.insert(users).values({
        email,
        password: "Password123!",
        firstName: "Card",
        lastName: "Tester",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        ssn: `ssn-${Date.now()}`,
        address: "123 Card St",
        city: "Card City",
        state: "NY",
        zipCode: "10001",
    }).returning().get();

    const ctx = {
        user: { id: user.id },
    } as any;

    const caller = accountRouter.createCaller(ctx);

    // Create an account to fund
    const account = await caller.createAccount({ accountType: "checking" });
    console.log(`Created account ${account.id} for testing.`);

    // Test Case: Invalid Card Number (fails Luhn)
    // 4111 1111 1111 1112 (This is invalid, check digit should be 1 for pure 1s/2s example, but let's use a known invalid one)
    // 4242 4242 4242 4241 is invalid (last digit should be 2 for it to be valid mostly, or similar)
    // Let's use 1234567890123456 - highly likely invalid Luhn
    const invalidCard = "1234567890123456";

    console.log(`\nTest Case: Attempting to fund account with invalid card number (${invalidCard})...`);

    try {
        const result = await caller.fundAccount({
            accountId: account.id,
            amount: 100,
            fundingSource: {
                type: "card",
                accountNumber: invalidCard,
            },
        });
        console.log("❌ FAILURE: Invalid card number was accepted! Bug reproduced.");
        console.log("Transaction ID:", result.transaction.id);
    } catch (error: any) {
        console.log("✅ SUCCESS: Invalid card number was rejected.");
        console.error(error.message);
    }

    // Cleanup
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    for (const acc of userAccounts) {
        await db.delete(transactions).where(eq(transactions.accountId, acc.id));
    }
    await db.delete(accounts).where(eq(accounts.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    console.log("\nCleanup complete.");
}

verifyValidCreditCardNumber().catch(console.error);
