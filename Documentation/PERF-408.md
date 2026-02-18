# PERF-408: Resource Leak Fix Report

## Issue Summary
**Ticket**: PERF-408  
**Severity**: Critical  
**Issue**: Database connections remain open and accumulate, leading to system resource exhaustion.  
**Impact**: Application instability and potential crash due to running out of file handles or database connection limits.

## Root Cause Analysis
The `initDb` function in `lib/db/index.ts` was creating a new database connection every time it was called (and initially on module import) and storing it in a global `connections` array without ever closing or reusing it.

**File**: `lib/db/index.ts`

**Problematic Pattern**:
```typescript
const connections: Database.Database[] = [];

export function initDb() {
  const conn = new Database(dbPath); // ❌ Creates new connection
  connections.push(conn);            // ❌ Stores it forever
  // ...
}
```

**Issues**:
1. **Unbounded Growth**: Every call to `initDb` added a new connection to the array.
2. **Duplicate Connections**: Even without calling `initDb` manually, the module scope created one, and `initDb` created another.
3. **No Cleanup**: Connections were never closed.

## Resolution
Implemented a singleton pattern to ensure only one database connection instance exists for the entire application lifecycle.

### Changes Implemented

**File**: `lib/db/index.ts`

1. **Singleton Pattern**: Used a global variable (compatible with HMR/Hot Module Replacement) to store the single database instance.
2. **Reuse**: `initDb` now uses the existing singleton instance instead of creating a new one.
3. **Cleanup**: Removed the `connections` array.

**Updated Code**:
```typescript
const globalForDb = global as unknown as { sqlite: Database.Database };

const sqlite = globalForDb.sqlite || new Database(dbPath);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export function initDb() {
  // Uses existing sqlite instance
  sqlite.exec(`...`);
}
```

**Benefits**:
- **Zero Leaks**: Connection count stays constant (1) regardless of how many times `initDb` is called.
- **HMR Support**: Preserves connection during development hot reloads.
- **Resource Efficiency**: Minimal memory and file handle usage.

## Validation

### Automated Testing
Created `tests/verify-db-connection.ts` to verify connection stability.

**Tests**:
- Confirms database queries work.
- Simulates multiple `initDb` calls to ensure no crashes or errors occur.

**Run Command**:
```bash
npx tsx tests/verify-db-connection.ts
```

**Result**: Passed ✅

## Preventive Measures

1. **Singleton for Infrastructure**: Always use the singleton pattern for heavy infrastructure objects like Database connections, Redis clients, etc.
2. **Avoid Global Arrays**: Be wary of pushing items into global arrays without a cleanup mechanism.
3. **Review Initialization Logic**: Ensure initialization functions are idempotent (safe to call multiple times without side effects).
