
import { db, initDb } from "../lib/db";
import { sql } from "drizzle-orm";

async function verifyConnection() {
    console.log("Starting database connection verification...");

    try {
        // 1. Check if we can run a query
        const result = await db.run(sql`SELECT 1 as val`);
        console.log("✅ Database query successful:", result);

        // 2. Simulate multiple initDb calls to check for connection leaks
        console.log("Simulating multiple initDb calls...");

        for (let i = 0; i < 5; i++) {
            initDb();
        }

        // We can't easily count open connections from here without exposing internals or using system tools,
        // but we can ensure the application doesn't crash and queries still work.

        const result2 = await db.run(sql`SELECT 1 as val`);
        console.log("✅ Database query after multiple inits successful:", result2);

        console.log("✅ Verification passed!");
    } catch (error) {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    }
}

verifyConnection();
