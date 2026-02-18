
import 'dotenv/config';
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Starting VAL-205 verification (Zero Amount Funding)...\n");

    const timestamp = Date.now();
    const testUser = {
        email: `test-val205-${timestamp}@example.com`,
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

    let userId: number | null = null;
    let accountId: number | null = null;

    try {
        const [user] = await db.insert(users).values(testUser).returning();
        userId = user.id;
        const [account] = await db.insert(accounts).values({
            userId: user.id,
            accountNumber: timestamp.toString().slice(-10),
            accountType: "checking",
            balance: 0,
            status: "active",
        }).returning();
        accountId = account.id;

        const ctx = {
            req: { headers: { get: () => "" } },
            res: { setHeader: () => { }, set: () => { } },
            user: { id: user.id },
        };
        const createCaller = createCallerFactory(accountRouter);
        const caller = createCaller(ctx as any);

        const validCard = "4111111111111111"; // Valid Visa

        // Test 1: Attempt to fund with $0.00
        console.log("\nTest 1: Attempting to fund with $0.00...");
        try {
            await caller.fundAccount({
                accountId: account.id,
                amount: 0,
                fundingSource: {
                    type: "card",
                    accountNumber: validCard,
                }
            });
            console.log("❌ FAILED: Should have rejected $0.00 funding");
        } catch (error: any) {
            if (error.message.includes("Amount must be at least $0.01")) {
                console.log("✓ Correctly rejected exact 0 with new message");
            } else if (error.message.includes("min")) {
                console.log("✓ Correctly rejected exact 0 with zod min error");
            } else {
                console.log(`✓ Rejected 0 with message: ${error.message}`);
            }
        }

        // Test 2: Attempt to fund with $0.001
        console.log("\nTest 2: Attempting to fund with $0.001...");
        try {
            await caller.fundAccount({
                accountId: account.id,
                amount: 0.001,
                fundingSource: {
                    type: "card",
                    accountNumber: validCard,
                }
            });
            console.log("❌ FAILED: $0.001 funding succeeded (Bug not fixed!)");
        } catch (error: any) {
            if (error.message.includes("Amount must be at least $0.01")) {
                console.log(`✓ Correctly rejected $0.001: ${error.message}`);
            } else {
                console.log(`✓ Rejected $0.001 with unexpected message: ${error.message}`);
            }
        }

        // Test 3: Attempt to fund with $0.01 (Should succeed)
        console.log("\nTest 3: Attempting to fund with $0.01...");
        try {
            const result = await caller.fundAccount({
                accountId: account.id,
                amount: 0.01,
                fundingSource: {
                    type: "card",
                    accountNumber: validCard,
                }
            });
            console.log("✓ Succeeded funding $0.01");
            console.log(`  New Balance: $${result.newBalance}`);
            if (result.newBalance !== 0.01) {
                console.log("❌ Balance mismatch!");
            }
        } catch (error: any) {
            console.log(`❌ Failed to fund $0.01: ${error.message}`);
        }

    } catch (e: any) {
        console.error("Error creating test data:", e);
    } finally {
        if (userId) {
            await db.delete(transactions).where(eq(transactions.accountId, accountId!));
            await db.delete(accounts).where(eq(accounts.userId, userId));
            await db.delete(users).where(eq(users.id, userId));
            console.log("\n✓ Cleanup complete");
        }
    }
}

main();
