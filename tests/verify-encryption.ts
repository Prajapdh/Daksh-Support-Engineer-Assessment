import 'dotenv/config';
import { authRouter } from "@/server/routers/auth";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

async function main() {
    const testUser = {
        email: "test-encryption@example.com",
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

    // Cleanup
    console.log("Cleaning up old test user...");
    try {
        const existing = await db.select().from(users).where(eq(users.email, testUser.email)).get();
        if (existing) {
            await db.delete(sessions).where(eq(sessions.userId, existing.id));
        }
        await db.delete(users).where(eq(users.email, testUser.email));
    } catch (e) {
        console.error("Cleanup FAILED:", e);
    }

    // Mock Context
    const ctx = {
        req: { headers: { get: () => "" } },
        res: {
            setHeader: (key: string, val: string) => console.log(`[Cookie Set] ${key}: ${val}`),
            set: (key: string, val: string) => console.log(`[Header Set] ${key}: ${val}`)
        },
        user: null,
    };

    const createCaller = createCallerFactory(authRouter);
    const caller = createCaller(ctx as any);

    console.log("Testing Signup...");
    const signupResult = await caller.signup(testUser);

    if ((signupResult.user as any).ssn) {
        console.error("FAIL: SSN returned in signup response");
        process.exit(1);
    } else {
        console.log("PASS: SSN not returned in signup response");
    }

    // Verify DB
    const dbUser = await db.select().from(users).where(eq(users.email, testUser.email)).get();
    if (!dbUser) {
        console.error("FAIL: User not found in DB");
        process.exit(1);
    }

    if (dbUser.ssn === testUser.ssn) {
        console.error("FAIL: SSN is stored in plaintext!");
        process.exit(1);
    }

    if (!dbUser.ssn.includes(":")) {
        console.error("FAIL: SSN does not look encrypted (no IV:TAG format)");
        process.exit(1);
    }

    // Try to decrypt
    const decryptedSSN = decrypt(dbUser.ssn);
    if (decryptedSSN !== testUser.ssn) {
        console.error(`FAIL: Decrypted SSN (${decryptedSSN}) does not match original (${testUser.ssn})`);
        process.exit(1);
    }
    console.log("PASS: SSN is encrypted in DB and can be decrypted");

    console.log("Testing Login...");
    const loginResult = await caller.login({
        email: testUser.email,
        password: testUser.password
    });

    if ((loginResult.user as any).ssn) {
        console.error("FAIL: SSN returned in login response");
        process.exit(1);
    } else {
        console.log("PASS: SSN not returned in login response");
    }

    console.log("All checks passed!");
}

main().catch(console.error);
