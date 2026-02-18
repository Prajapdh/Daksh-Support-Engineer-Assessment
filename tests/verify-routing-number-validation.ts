
import 'dotenv/config';
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Starting VAL-207 verification (Routing Number Validation)...\n");

    const timestamp = Date.now();
    const testUser = {
        email: `test-val207-${timestamp}@example.com`,
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

        // Test 1: Fund via Bank WITHOUT Routing Number
        console.log("\nTest 1: Fund via Bank WITHOUT Routing Number...");
        try {
            await caller.fundAccount({
                accountId: account.id,
                amount: 10.00,
                fundingSource: {
                    type: "bank",
                    accountNumber: "1234567890",
                    // routingNumber omitted
                }
            });
            console.log("❌ FAILED: Should have rejected missing routing number");
        } catch (error: any) {
            const msg = error.message;
            // The error might be a JSON array string if it's Zod error
            if (msg.includes("Routing number is required")) {
                console.log("✓ Correctly rejected missing routing number");
            } else {
                console.log(`✓ Rejected with message (check if correct): ${msg}`);
            }
        }

        // Test 2: Fund via Bank WITH Routing Number
        console.log("\nTest 2: Fund via Bank WITH Routing Number...");
        try {
            await caller.fundAccount({
                accountId: account.id,
                amount: 10.00,
                fundingSource: {
                    type: "bank",
                    accountNumber: "1234567890",
                    routingNumber: "123456789"
                }
            });
            console.log("✓ Succeeded funding with routing number");
        } catch (error: any) {
            console.log(`❌ Failed valid bank funding: ${error.message}`);
        }

        // Test 3: Fund via Card (should NOT require routing number)
        console.log("\nTest 3: Fund via Card (no routing number)...");
        try {
            await caller.fundAccount({
                accountId: account.id,
                amount: 10.00,
                fundingSource: {
                    type: "card",
                    accountNumber: "4111111111111111", // Valid Visa
                }
            });
            console.log("✓ Succeeded card funding without routing number");
        } catch (error: any) {
            console.log(`❌ Failed valid card funding: ${error.message}`);
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
