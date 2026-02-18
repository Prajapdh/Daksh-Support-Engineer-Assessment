
import { authRouter } from "../server/routers/auth";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyStrongPassword() {
    console.log("Testing Password Requirements...");

    // Setup: Mock context
    const ctx = {
        res: {
            setHeader: (name: string, value: string) => {
                // console.log(`[Mock] Check Cookie: ${name}=${value}`);
            },
        },
    } as any;

    // Test Case: Weak Password (only matches length 8, but no complexity)
    const weakPassword = "password123"; // 11 chars, lowercase + number. Missing uppercase, special char depending on rules.
    // Current rule is just min(8). So this should pass currently (bug).
    // Target rule: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.

    console.log(`\nTest Case: Attempting signup with weak password '${weakPassword}'...`);
    const weakPasswordInput = {
        email: `weak.pass.${Date.now()}@example.com`,
        password: weakPassword,
        firstName: "Weak",
        lastName: "Pass",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        ssn: "123456789",
        address: "123 Weak St",
        city: "Weak City",
        state: "NY",
        zipCode: "10001",
    };

    try {
        const result = await authRouter.createCaller(ctx).signup(weakPasswordInput);
        console.log("❌ FAILURE: Weak password was accepted! Bug reproduced.");

        // Cleanup created user
        if (result.user && result.user.id) {
            await db.delete(users).where(eq(users.id, result.user.id));
        }
    } catch (error: any) {
        console.log("✅ SUCCESS: Weak password was rejected.");
        console.error(error.message);
    }
}

verifyStrongPassword().catch(console.error);
