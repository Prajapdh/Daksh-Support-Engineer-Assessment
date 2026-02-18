
import { authRouter } from "../server/routers/auth";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyValidDateOfBirth() {
    console.log("Testing Date of Birth Validation...");

    // Setup: Mock context
    const ctx = {
        res: {
            setHeader: (name: string, value: string) => {
                console.log(`[Mock] Check Cookie: ${name}=${value}`);
            },
        },
    } as any;

    // Test Case 1: Future Date of Birth
    console.log("\nTest Case 1: Attempting signup with future DOB (2050-01-01)...");
    const futureDobInput = {
        email: `future.dob.${Date.now()}@example.com`,
        password: "Password123!",
        firstName: "Future",
        lastName: "User",
        phoneNumber: "1234567890",
        dateOfBirth: "2050-01-01",
        ssn: "123456789", // Note: In a real scenario, this should be valid format
        address: "123 Future St",
        city: "Future City",
        state: "NY",
        zipCode: "10001",
    };

    try {
        await authRouter.createCaller(ctx).signup(futureDobInput);
        console.log("❌ FAILURE: Future DOB was accepted! Bug reproduced.");
    } catch (error: any) {
        console.log("✅ SUCCESS: Future DOB was rejected.");
        console.error(error.message);
    }

    // Test Case 2: Under 18 (Minor)
    // Calculate a date for a 10 year old
    const today = new Date();
    const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const minorDob = tenYearsAgo.toISOString().split('T')[0];

    console.log(`\nTest Case 2: Attempting signup with minor DOB (${minorDob})...`);
    const minorDobInput = {
        email: `minor.dob.${Date.now()}@example.com`,
        password: "Password123!",
        firstName: "Minor",
        lastName: "User",
        phoneNumber: "1234567890",
        dateOfBirth: minorDob,
        ssn: "987654321",
        address: "123 Minor St",
        city: "Minor City",
        state: "NY",
        zipCode: "10001",
    };

    try {
        await authRouter.createCaller(ctx).signup(minorDobInput);
        console.log("❌ FAILURE: Minor DOB was accepted! Bug reproduced.");
    } catch (error: any) {
        console.log("✅ SUCCESS: Minor DOB was rejected.");
        console.error(error.message);
    }

}

verifyValidDateOfBirth().catch(console.error);
