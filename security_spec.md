# Security Specification for GKLI Finance App

## 1. Data Invariants
- A Payment must always reference a valid Church ID.
- Users can only read data if they are authenticated.
- Only users with `superadmin` role can modify critical settings and delete churches.
- `staff` can create and update payments but cannot delete churches or manage users.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Read**: Attempting to read `/churches` without a token.
2. **Identity Spoofing**: User A trying to update User B's role document.
3. **Ghost Fields**: Adding `isAdmin: true` to a payment document.
4. **Invalid IDs**: Using a 2MB string as a `churchId`.
5. **Orphaned Payments**: Creating a payment for a non-existent church.
6. **State Shortcut**: Setting a payment amount to a negative number.
7. **Bypass Role**: A `staff` user trying to update `/settings/config`.
8. **Malicious Delete**: A `staff` user trying to delete a `/churches/{id}` doc.
9. **Invalid Type**: Sending a boolean to a field expected to be a number.
10. **Timestamp Fraud**: Providing a fake `createdAt` from the future.
11. **Excessive List**: Trying to fetch the entire collection without any filter if it was private.
12. **PII Leak**: Reading someone's private profile documentation.

## 3. Test Runner
(I will implement the rules and verify them)
