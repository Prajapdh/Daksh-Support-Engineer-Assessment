# PERF-406: Balance Calculation Fix Report

## Issue Summary
**Ticket**: PERF-406
**Severity**: Critical
**Issue**: Account balances were becoming incorrect after multiple transactions due to floating-point precision errors.
**Impact**: Financial discrepancies in user accounts, leading to potential loss of funds or incorrect reporting.

## Root Cause Analysis
The application was using the `REAL` (floating-point) data type for storing monetary values (`balance` and `amount`) in the SQLite database. Additionally, an unnecessary loop in the fund account logic was exacerbating floating-point errors.
- **File**: `server/routers/account.ts`
- **Code**: `finalBalance = finalBalance + amount / 100` (inside a loop) and usage of `REAL` in `lib/db/schema.ts`.

## Resolution
We migrated the database to store monetary values as integers (cents) instead of floating-point numbers (dollars). We also refactored the transaction logic to perform integer arithmetic.

### Changes Implemented
1.  **Database Schema**: Modified `lib/db/schema.ts` to change `balance` and `amount` columns from `real` to `integer`.
2.  **Data Migration**: Created and executed `scripts/migrate-to-cents.ts` to convert existing floating-point values to integers (cents) by multiplying by 100, preserving data integrity.
3.  **Backend Logic**: Updated `server/routers/account.ts` to:
    - Handle input amounts in dollars and convert them to cents for storage.
    - Perform all balance calculations using integers.
    - Return balances and amounts in dollars to the client by dividing by 100.
    - Removed the artificial loop that was introducing errors.
    - Implemented atomic balance updates (`UPDATE accounts SET balance = balance + ?`) to prevent race conditions.
    - Fixed transaction lookup to return the exact inserted transaction using `.returning()` instead of selecting the oldest one.

### Validation
- Ran `tests/verify-balance-calculation.ts` which simulated multiple transactions. It previously failed with precision errors (e.g., getting `3.0000000000000013` instead of `3`) and now passes with exact integer matches (stored as `300` cents).

## Preventive Measures
1.  **Integer Math for Money**: Always use integers (cents) for monetary storage and arithmetic. Avoid floating-point types for financial data.
2.  **Database Constraints**: Enforce integer types in the database schema for any new monetary fields.
3.  **Code Reviews**: Flag any use of `float` or `double` for currency during code reviews.

## Deployment Instructions
1.  **Backup Database**: Ensure a backup of `bank.db` is taken before deployment.
2.  **Run Migration**: Execute `npx tsx scripts/migrate-to-cents.ts` to convert existing data.
3.  **Deploy Code**: Deploy the updated application code with the new schema definition.
