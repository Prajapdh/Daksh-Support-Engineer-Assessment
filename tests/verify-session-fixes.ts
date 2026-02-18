import 'dotenv/config';
import { authRouter } from "@/server/routers/auth";
import { accountRouter } from "@/server/routers/account";
import { createCallerFactory } from "@/server/trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import crypto from "crypto";


// Mock Request/Response objects
const createMockCtx = (token?: string) => {
    return {
        req: {
            headers: {
                cookie: token ? `session=${token}` : "",
                get: (key: string) => key === "cookie" ? (token ? `session=${token}` : "") : "",
            }
        },
        res: {
            setHeader: (key: string, val: string) => { },
            set: (key: string, val: string) => { }
        },
        user: null, // Will be populated by createCaller if token is valid
    };
};

async function verifySessionFixes() {
    console.log("Starting Session Fixes Verification...");

    // Setup: Create a unique user for testing
    const timestamp = Date.now();
    const email = `test-session-${timestamp}@example.com`;
    const password = "Password123!";

    // 1. Test SEC-304: Single Session Enforcement
    console.log("\n--- Verifying SEC-304 (Single Session) ---");

    // Cleanup any leftover test data from previous runs
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
        await db.delete(sessions).where(eq(sessions.userId, existingUser.id));
        await db.delete(users).where(eq(users.id, existingUser.id));
        console.log("Cleaned up leftover test data.");
    }

    const authCaller = createCallerFactory(authRouter)(createMockCtx() as any);

    // Signup - use unique 9-digit SSN based on timestamp
    const ssnSuffix = String(timestamp).slice(-9).padStart(9, '0');
    console.log("Signing up user...");
    const signupResult = await authCaller.signup({
        email,
        password,
        firstName: "Session",
        lastName: "Tester",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        ssn: ssnSuffix,
        address: "123 Test St",
        city: "Test City",
        state: "CA",
        zipCode: "12345",
    });

    const user = signupResult.user;
    const tokenA = signupResult.token;
    console.log("User signed up. Session A created.");

    // Login again (Session B)
    console.log("Logging in again (creating Session B)...");
    const loginResult = await authCaller.login({ email, password });
    const tokenB = loginResult.token;
    console.log("Session B created.");

    // Verify Session A is gone
    const sessionA = await db.select().from(sessions).where(eq(sessions.token, tokenA)).get();
    const sessionB = await db.select().from(sessions).where(eq(sessions.token, tokenB)).get();

    if (!sessionA) {
        console.log("PASS: Session A was successfully invalidated.");
    } else {
        console.error("FAIL: Session A still exists!");
        process.exit(1);
    }

    if (sessionB) {
        console.log("PASS: Session B is active.");
    } else {
        console.error("FAIL: Session B was not found!");
        process.exit(1);
    }

    // 2. Test PERF-403: Expiry Buffer
    console.log("\n--- Verifying PERF-403 (Expiry Buffer) ---");

    // We need to access protected procedures to test session validation
    // createCallerFactory needs to be called with a context that *might* resolve the user
    // But `createContext` logic is what checks expiry. 
    // Since we are mocking `createContext` roughly in `trpc.ts`, we need to simulate how `createCaller` works or directly test `createContext` logic if exported?
    // Start locally: The `createContext` in `server/trpc.ts` is what we changed. 
    // We can't easily import `createContext` if it relies on Next.js types cleanly without a real request, 
    // BUT we can use the `createCaller` which uses `t.createCallerFactory`.
    // Wait, `createCallerFactory` takes the *router* and returns a function that takes *context*.
    // It does NOT run `createContext` for us unless we use the inner TRPC internals or pass the result of createContext.

    // Actually, `createCaller` expects the *result* of createContext (the context object). 
    // Our fix is IN `createContext`. 
    // So to test the fix, we should import `createContext` from `@/server/trpc` and call it directly with mocked request options.

    const { createContext } = await import("@/server/trpc");

    // Clear all sessions for this user before PERF-403 tests
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    // Case 1: Session expires in 30 seconds (Should be INVALID due to 60s buffer)
    console.log("Creating session expiring in 30s...");
    const tokenSoon = jwt.sign(
        { userId: user.id, jti: crypto.randomUUID() },
        process.env.JWT_SECRET || "temporary-secret-for-interview",
        { expiresIn: '1h' }
    );
    const expiresSoon = new Date(Date.now() + 30000); // 30 seconds from now

    await db.insert(sessions).values({
        userId: user.id,
        token: tokenSoon,
        expiresAt: expiresSoon.toISOString(),
    });

    const ctxSoon = await createContext({
        req: {
            headers: {
                get: (k: string) => k === 'cookie' ? `session=${tokenSoon}` : ''
            }
        } as any,
        resHeaders: {} as any
    });

    if (ctxSoon.user) {
        console.error("FAIL: User should NOT be authenticated (Buffer check failed)");
        console.log("Expires At:", expiresSoon.toISOString());
        console.log("Now:", new Date().toISOString());
        process.exit(1);
    } else {
        console.log("PASS: Session rejected (within 1m buffer).");
    }

    // Case 2: Session expires in 2 minutes (Should be VALID)
    console.log("Creating session expiring in 2m...");
    const tokenSafe = jwt.sign(
        { userId: user.id, jti: crypto.randomUUID() },
        process.env.JWT_SECRET || "temporary-secret-for-interview",
        { expiresIn: '1h' }
    );
    const expiresSafe = new Date(Date.now() + 120000); // 2 minutes from now

    await db.insert(sessions).values({
        userId: user.id,
        token: tokenSafe,
        expiresAt: expiresSafe.toISOString(),
    });

    const ctxSafe = await createContext({
        req: {
            headers: {
                get: (k: string) => k === 'cookie' ? `session=${tokenSafe}` : ''
            }
        } as any,
        resHeaders: {} as any
    });

    if (ctxSafe.user) {
        console.log("PASS: Session accepted (outside 1m buffer).");
    } else {
        console.error("FAIL: User SHOULD be authenticated");
        process.exit(1);
    }

    console.log("\nAll Verification Checks Passed!");

    // Cleanup
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
}

verifySessionFixes().catch((err) => {
    console.error("Test failed unhandled:", err);
    process.exit(1);
});
