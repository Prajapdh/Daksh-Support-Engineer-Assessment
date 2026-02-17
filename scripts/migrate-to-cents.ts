
import 'dotenv/config';
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Starting migration to cents...");

    // 1. Migrate Accounts
    const allAccounts = await db.select().from(accounts).all();
    console.log(`Found ${allAccounts.length} accounts to migrate.`);

    for (const account of allAccounts) {
        // Check if allow integer? No schema is not changed yet.
        // We are updating the VALUES in place. SQLite is dynamically typed mostly except when strict.
        // Drizzle schema definition defines how it reads/writes.
        // We are just updating the number.

        // Use Math.round to ensure we get the nearest integer representation of the float money
        const newBalance = Math.round(account.balance * 100);

        console.log(`Migrating Account ${account.id}: ${account.balance} -> ${newBalance}`);

        await db.update(accounts)
            .set({ balance: newBalance })
            .where(sql`${accounts.id} = ${account.id}`);
    }

    // 2. Migrate Transactions
    const allTransactions = await db.select().from(transactions).all();
    console.log(`Found ${allTransactions.length} transactions to migrate.`);

    for (const transaction of allTransactions) {
        const newAmount = Math.round(transaction.amount * 100);
        console.log(`Migrating Transaction ${transaction.id}: ${transaction.amount} -> ${newAmount}`);

        await db.update(transactions)
            .set({ amount: newAmount })
            .where(sql`${transactions.id} = ${transaction.id}`);
    }

    console.log("Migration completed successfully.");
}

main().catch(console.error);
