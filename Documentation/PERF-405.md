# PERF-405: Missing Transactions Fix Report

## Issue Summary
**Ticket**: PERF-405
**Severity**: Critical
**Issue**: Not all transactions appear in history after multiple funding events.
**Impact**: Users cannot verify their transaction history, leading to confusion and lack of trust in account balance accuracy.

## Root Cause Analysis
Several issues contributed to the "missing" or inconsistent transaction reports:
1.  **Missing Query Invalidation (Frontend)**: The `getTransactions` query was not being invalidated after a successful `fundAccount` mutation. React Query (via tRPC) continued to show cached data instead of fetching the newly created transaction.
2.  **Unstable Sorting (Backend)**: The `getTransactions` procedure lacked a deterministic `orderBy` clause. While it fetched records, the order was non-deterministic (often defaulting to insertion order or whatever the DB chose), making it appear as if transactions were missing or randomly appearing.
3.  **Low Precision Timestamps**: The schema used SQLite's `CURRENT_TIMESTAMP` which has 1-second resolution. Rapid funding events during the same second would have identical timestamps, causing stable sorting issues when only sorting by `createdAt`.
4.  **Performance Inefficiency (N+1)**: The backend performed a separate query for *each* transaction to fetch the account type, leading to severe performance degradation as history grew.

## Resolution
We implemented a multi-layered fix covering frontend refresh logic, backend query optimization, and data integrity.

### Changes Implemented
1.  **Frontend Invalidation**:
    - **File**: `app/dashboard/page.tsx`
    - **Change**: Added `trpc.useUtils()` and updated the `FundingModal` `onSuccess` callback to explicitly invalidate the `getTransactions` query for the specific account. This ensures immediate UI updates.
2.  **Backend Optimization & Sorting**:
    - **File**: `server/routers/account.ts`
    - **Change**: Added `.orderBy(desc(transactions.createdAt), desc(transactions.id))`. Sorting by `id` as a tie-breaker ensures a stable, deterministic sort order even for transactions created in the same millisecond.
    - **Change**: Removed the N+1 query loop. Since all fetched transactions belong to the same account, the `accountType` is now derived efficiently from the initial account verification check.
3.  **High-Precision Timestamps**:
    - **File**: `server/routers/account.ts`
    - **Change**: Explicitly set `createdAt` using `new Date().toISOString()` during insertion to provide millisecond-level precision, improving sorting accuracy.
4.  **Atomic Updates & Data Integrity**:
    - **File**: `server/routers/account.ts`
    - **Change**: Switched to using `.returning()` on the insert statement to get the actual row created, preventing any "mismatch" between what was sent and what was saved.
5.  **Hydration Fix**:
    - **File**: `app/layout.tsx`
    - **Change**: Added `suppressHydrationWarning` to the `<html>` tag to resolve a common Next.js/React hydration mismatch error caused by browser extensions or system-level theme adjustments.

## Validation
### Automated Testing
- Created `tests/verify-transactions.ts` which simulates rapid funding events (3 transactions within 300ms).
- **Result**: The script verifies that exactly 3 transactions are returned and they are sorted in strict descending order by datetime and ID.

### Manual Verification
- Verified on the dashboard that funding an account immediately updates the transaction list without requiring a page refresh.
- Verified that the "Hydration Error" no longer appears in the browser console.

## Preventive Measures
1.  **Always Invalidate on Mutation**: Ensure that any mutation that affects list data (like adding a transaction) triggers an invalidation of the corresponding getter query.
2.  **Deterministic Sorting**: Every list-fetching API should have an explicit `orderBy` clause with an ID tie-breaker to prevent "jumping" or "missing" items in the UI.
3.  **Avoid N+1 Queries**: Use joins or leverage contextually available data instead of querying children in a loop.
4.  **Millisecond Precision**: When using SQLite for time-sensitive audit trails, prefer application-side ISO strings over database-level defaults for higher precision.
