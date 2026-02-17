import 'dotenv/config';
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

async function migrate() {
    console.log("Starting SSN migration...");

    const allUsers = await db.select().from(users).all();
    console.log(`Found ${allUsers.length} users.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of allUsers) {
        try {
            // robust check for already encrypted data
            // format: iv:tag:content (all hex)
            // iv is 16 bytes (32 hex chars)
            // tag is 16 bytes (32 hex chars)
            // content is variable
            const parts = user.ssn.split(':');
            const isEncrypted = parts.length === 3 &&
                parts[0].length === 32 &&
                parts[1].length === 32;

            if (isEncrypted) {
                skippedCount++;
                continue;
            }

            console.log(`Eycrpting SSN for user ID: ${user.id}`);
            const encryptedSSN = encrypt(user.ssn);

            await db.update(users)
                .set({ ssn: encryptedSSN })
                .where(eq(users.id, user.id));

            migratedCount++;
        } catch (error) {
            console.error(`Failed to migrate user ${user.id}:`, error);
            errorCount++;
        }
    }

    console.log("Migration complete.");
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already encrypted): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
}

migrate().catch(console.error);
