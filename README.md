# SecureBank - SDET Technical Interview

This repository contains a banking application for the Software Development Test Engineer (SDET) technical interview.

## 📋 Challenge Submission

Please see [CHALLENGE.md](./CHALLENGE.md) for complete instructions and requirements.

This project was approached with a production-first mindset, focusing on:

* Financial accuracy and data integrity
* Security hardening and compliance awareness
* Clear documentation of root causes and long-term preventive measures
* Testability and verification of fixes

In resolving the reported issues, I prioritized critical financial, security, and compliance risks before addressing validation and UX concerns. Where applicable, fixes were implemented at the root cause rather than applying surface-level patches.

I incorporated engineering practices I’ve developed through my academic and professional experience.

I welcome feedback on architectural decisions, trade-offs, and areas for further improvement.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the application
npm run dev

# Open http://localhost:3000
```

## 🛠 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:list-users` - List all users in database
- `npm run db:list-sessions` - List all sessions in database
- `npm run db:clear` - Clear all database data
- `npm run db:delete-user <email>` - Delete a specific user by email

## 🧪 Running Tests

Tests are located in the [`/tests`](./tests) directory and are run individually using `tsx`:

```bash
npx tsx tests/<test-file>.ts
```

Example:
```bash
npx tsx tests/verify-session-fixes.ts
```

---

## 🐛 Bug Fix Log

All resolved tickets are documented in the [`/Documentation`](./Documentation) directory.

### Prioritization Framework

Tickets were triaged into three priority levels:

| Priority | Label | Criteria |
|---|---|---|
| 🔴 **P0** | Critical — Fix Immediately | Affects money accuracy, legal compliance, or active security exploits |
| 🟠 **P1** | High Priority | Important security/reliability gaps, not immediately catastrophic |
| 🟡 **P2** | Medium | UX improvements, edge cases, non-blocking issues |

---

### 🔴 P0 — Critical (Fix First)

These affect financial accuracy, legal compliance, or are active exploit vectors. Any one of these could result in regulatory fines, lawsuits, or complete loss of customer trust.

| Ticket | Title | Reason for P0 | Documentation | Test |
|---|---|---|---|---|
| **SEC-301** | SSN Stored in Plaintext | Legal/compliance disaster (PCI, privacy regulations). Data breach = lawsuits, fines, company-ending liability. | [SEC-301.md](./Documentation/SEC-301.md) | [verify-encryption.ts](./tests/verify-encryption.ts) |
| **SEC-303** | XSS Vulnerability | Active exploit vector. Enables account takeover, session hijacking, and arbitrary script execution. | [SEC-303.md](./Documentation/SEC-303.md) | [verify-transaction-xss-vulnerability.ts](./tests/verify-transaction-xss-vulnerability.ts) |
| **PERF-406** | Incorrect Balance Calculation | Direct financial inaccuracy. Regulatory violation. If balances are wrong, nothing else matters. | [PERF-406.md](./Documentation/PERF-406.md) | [verify-balance-calculation.ts](./tests/verify-balance-calculation.ts) |
| **PERF-405** | Missing Transactions | Financial transparency failure. Users cannot verify money flow. Could indicate DB logic failure. | [PERF-405.md](./Documentation/PERF-405.md) | [verify-transactions.ts](./tests/verify-transactions.ts) |
| **PERF-401** | Account Creation Shows $100 When DB Fails | Shows money that doesn't exist. Critical accounting inconsistency. | [PERF-401.md](./Documentation/PERF-401.md) | [verify-account-creation.ts](./tests/verify-account-creation.ts) |
| **PERF-408** | Database Connection Leak | System crash under load. Banking app downtime is unacceptable. | [PERF-408.md](./Documentation/PERF-408.md) | [verify-db-connection.ts](./tests/verify-db-connection.ts) |
| **VAL-202** | Date of Birth Accepts Future Dates | KYC compliance issue. Accepting minors or invalid dates is a regulatory risk. | [VAL-202.md](./Documentation/VAL-202.md) | [verify-valid-date-of-birth.ts](./tests/verify-valid-date-of-birth.ts) |
| **VAL-206** | Card Number Validation | Failed payments, payment processor rejection, severe user frustration. | [VAL-206.md](./Documentation/VAL-206.md) | [verify-valid-credit-card-number.ts](./tests/verify-valid-credit-card-number.ts) |
| **VAL-208** | Weak Password Requirements | Direct account takeover risk. Weak passwords = direct security exposure. | [VAL-208.md](./Documentation/VAL-208.md) | [verify-strong-password.ts](./tests/verify-strong-password.ts) |

---

### 🟠 P1 — High Priority

Important security and reliability gaps. Not immediately catastrophic but must be addressed promptly.

| Ticket | Title | Reason for P1 | Documentation | Test |
|---|---|---|---|---|
| **VAL-205** | $0 Funding Allowed | Zero-amount transactions pollute transaction history and indicate missing validation. | [VAL-205.md](./Documentation/VAL-205.md) | [verify-zero-amount-funding.ts](./tests/verify-zero-amount-funding.ts) |
| **VAL-207** | Routing Number Optional on Transfers | Missing routing number can cause failed or misdirected transfers. | [VAL-207.md](./Documentation/VAL-207.md) | [verify-routing-number-validation.ts](./tests/verify-routing-number-validation.ts) |
| **SEC-302** | `Math.random()` for Account Numbers | Predictable account numbers are a security risk, though not immediately exploitable. | [SEC-302.md](./Documentation/SEC-302.md) | [verify-secure-random.ts](./tests/verify-secure-random.ts) |
| **SEC-304** | Multiple Valid Sessions Per User | Stolen sessions remain valid indefinitely. Enforcing single session limits exposure window. | [SEC-304.md](./Documentation/SEC-304.md) | [verify-session-fixes.ts](./tests/verify-session-fixes.ts) |
| **PERF-403** | Session Expiry Race Condition | Sessions valid until exact millisecond of expiry create race conditions and inconsistent auth. | [PERF-403.md](./Documentation/PERF-403.md) | [verify-session-fixes.ts](./tests/verify-session-fixes.ts) |
| **VAL-210** | Card Type Detection | Incorrect card type detection leads to wrong payment routing and user confusion. | [VAL-210.md](./Documentation/VAL-210.md) | [verify-card-type-detection.ts](./tests/verify-card-type-detection.ts) |

---

## 📁 Project Structure

```
/
├── app/                  # Next.js App Router pages & API routes
├── components/           # Shared React components
├── server/
│   ├── routers/          # tRPC routers (auth, account, etc.)
│   └── trpc.ts           # tRPC context & middleware (session validation)
├── lib/
│   ├── db/               # Drizzle ORM schema & database client
│   └── encryption.ts     # AES-256 encryption utilities
├── Documentation/        # Bug fix reports for each resolved ticket
├── tests/                # Verification scripts for each fix
└── scripts/              # Database utility scripts
```
