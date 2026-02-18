
import 'dotenv/config';
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Starting account creation verification script...\n");

    // 1. Create a test user
    const timestamp = Date.now();
    const testUser = {
        email: `test-account-${timestamp}@example.com`,
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
    console.log(`✓ Created test user with ID: ${insertedUser.id}`);

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

    try {
        // 3. Test: Create a checking account
        console.log("\nTest 1: Creating checking account...");
        const checkingAccount = await caller.createAccount({ accountType: "checking" });

        // Verify the account was created
        if (!checkingAccount) {
            throw new Error("Account creation returned null/undefined");
        }

        if (!checkingAccount.id || checkingAccount.id === 0) {
            throw new Error(`Account has invalid ID: ${checkingAccount.id}`);
        }

        if (checkingAccount.balance !== 0) {
            throw new Error(`Expected balance to be 0, got ${checkingAccount.balance}`);
        }

        if (checkingAccount.accountType !== "checking") {
            throw new Error(`Expected accountType to be 'checking', got ${checkingAccount.accountType}`);
        }

        if (checkingAccount.status !== "active") {
            throw new Error(`Expected status to be 'active', got ${checkingAccount.status}`);
        }

        if (!checkingAccount.accountNumber || checkingAccount.accountNumber.length !== 10) {
            throw new Error(`Invalid account number: ${checkingAccount.accountNumber}`);
        }

        console.log(`✓ Checking account created successfully`);
        console.log(`  - ID: ${checkingAccount.id}`);
        console.log(`  - Account Number: ${checkingAccount.accountNumber}`);
        console.log(`  - Balance: $${checkingAccount.balance.toFixed(2)}`);
        console.log(`  - Status: ${checkingAccount.status}`);

        // 4. Test: Verify account exists in database
        console.log("\nTest 2: Verifying account in database...");
        const dbAccount = await db.select().from(accounts).where(eq(accounts.id, checkingAccount.id)).get();

        if (!dbAccount) {
            throw new Error("Account not found in database");
        }

        if (dbAccount.balance !== 0) {
            throw new Error(`Database balance should be 0 cents, got ${dbAccount.balance}`);
        }

        console.log(`✓ Account verified in database`);
        console.log(`  - DB Balance (cents): ${dbAccount.balance}`);
        console.log(`  - API Balance (dollars): $${checkingAccount.balance.toFixed(2)}`);

        // 5. Test: Create a savings account
        console.log("\nTest 3: Creating savings account...");
        const savingsAccount = await caller.createAccount({ accountType: "savings" });

        if (!savingsAccount || savingsAccount.id === 0) {
            throw new Error("Savings account creation failed");
        }

        if (savingsAccount.accountType !== "savings") {
            throw new Error(`Expected accountType to be 'savings', got ${savingsAccount.accountType}`);
        }

        console.log(`✓ Savings account created successfully`);
        console.log(`  - ID: ${savingsAccount.id}`);
        console.log(`  - Account Number: ${savingsAccount.accountNumber}`);

        // 6. Test: Verify duplicate account prevention
        console.log("\nTest 4: Testing duplicate account prevention...");
        try {
            await caller.createAccount({ accountType: "checking" });
            throw new Error("Should have thrown error for duplicate account");
        } catch (error: any) {
            if (error.message.includes("already have a checking account")) {
                console.log(`✓ Duplicate account prevention working correctly`);
            } else {
                throw error;
            }
        }

        // 7. Test: Verify both accounts are retrievable
        console.log("\nTest 5: Retrieving all accounts...");
        const allAccounts = await caller.getAccounts();

        if (allAccounts.length !== 2) {
            throw new Error(`Expected 2 accounts, got ${allAccounts.length}`);
        }

        console.log(`✓ Retrieved ${allAccounts.length} accounts successfully`);

        console.log("\n" + "=".repeat(50));
        console.log("✅ ALL TESTS PASSED!");
        console.log("=".repeat(50));

    } catch (e: any) {
        console.error("\n" + "=".repeat(50));
        console.error("❌ TEST FAILED");
        console.error("=".repeat(50));
        console.error("Error:", e.message);
        if (e.stack) {
            console.error("\nStack trace:", e.stack);
        }
        process.exit(1);
    } finally {
        // Cleanup
        console.log("\nCleaning up test data...");
        await db.delete(accounts).where(eq(accounts.userId, insertedUser.id));
        await db.delete(users).where(eq(users.id, insertedUser.id));
        console.log("✓ Cleanup complete");
    }
}

main().catch(console.error);
