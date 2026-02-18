# PERF-401: Account Creation Error Fix Report

## Issue Summary
**Ticket**: PERF-401  
**Severity**: Critical  
**Issue**: New accounts show incorrect balance when database operations fail  
**Impact**: Users see fake account information with invalid IDs, leading to confusion and subsequent operation failures

## Root Cause Analysis
The `createAccount` mutation in `server/routers/account.ts` used a two-step process: insert the account, then fetch it back. When the fetch failed, the code returned a fabricated fallback object instead of throwing an error.

**File**: `server/routers/account.ts` (lines 46-67)

**Problematic Pattern**:
```typescript
await db.insert(accounts).values({ ... });
const account = await db.select().from(accounts).where(...).get();

return account
  ? { ...account, balance: account.balance / 100 }
  : {  // ❌ Returns fake data if fetch fails
      id: 0,  // Invalid ID that doesn't exist in database
      userId: ctx.user.id,
      accountNumber: accountNumber!,
      accountType: input.accountType,
      balance: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
```

**Issues**:
1. **Two Separate Operations**: Insert and fetch are separate, creating a race condition where the fetch could fail even if insert succeeds
2. **Fake Data**: Returns a fabricated object with `id: 0` when fetch fails
3. **Silent Failure**: User sees an account that doesn't exist, masking the real error
4. **Broken Subsequent Operations**: Any operation using `id: 0` will fail

## Resolution
Replaced the two-step insert + fetch pattern with Drizzle's atomic `.returning()` method, which inserts and returns the created row in a single operation.

### Changes Implemented

**File**: `server/routers/account.ts` (lines 46-62)

1. **Atomic Insert with `.returning()`**: Combined insert and fetch into one operation
2. **Proper Error Handling**: Throw `TRPCError` instead of returning fake data
3. **Removed Fallback Logic**: Eliminated the ternary operator that returned fabricated objects

**Updated Code**:
```typescript
// Insert account and return the created row atomically
const [account] = await db.insert(accounts).values({
  userId: ctx.user.id,
  accountNumber: accountNumber!,
  accountType: input.accountType,
  balance: 0,
  status: "active",
}).returning();

// Verify the account was created successfully
if (!account) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create account",
  });
}

return { ...account, balance: account.balance / 100 };
```

**Benefits**:
- Single database operation (more efficient, no race conditions)
- Guaranteed to return the actual inserted row
- Clear error messages when operations fail
- No fake data returned to users

## Validation

### Automated Testing
Created `tests/verify-account-creation.ts` to verify account creation works correctly.

**Tests**:
- Account creation returns valid database ID (not 0)
- Balance is properly converted from cents to dollars
- Account exists in database after creation
- Duplicate account prevention works
- Multiple account types can be created

**Run Command**:
```bash
npx tsx tests/verify-account-creation.ts
```

**Result**: All tests passed ✅

### Manual Verification
- Created new user account via registration flow
- Created checking and savings accounts
- Verified accounts display with $0.00 balance
- Verified account numbers are generated correctly
- Confirmed no console errors during account creation

## Preventive Measures

1. **Use `.returning()` for Inserts**: Always use `.returning()` when you need the inserted data back. This is the standard Drizzle pattern for atomic insert operations.

2. **Avoid Fallback Objects**: Never return fabricated data when operations fail. Throw proper `TRPCError` exceptions instead so errors are visible and debuggable.

3. **Atomic Operations**: Prefer single atomic database operations over multi-step processes to avoid race conditions and inconsistent state.

4. **Error Handling Standards**: Establish consistent error handling patterns:
   - Use `TRPCError` with appropriate error codes
   - Provide clear error messages
   - Log errors for debugging

5. **Code Review Checklist**: When reviewing database operations, verify:
   - Inserts use `.returning()` when data is needed
   - No fake/fallback data is returned
   - Errors are properly thrown and handled
   - Operations are atomic when possible

6. **Integration Tests**: Add tests that verify the full API-to-database flow, including error cases and data transformations.
