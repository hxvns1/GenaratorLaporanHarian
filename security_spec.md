# Firestore Security Specification — Laporan Kegiatan Unit PKP-PK

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are denied for read and write.
2. **Verified Authentication**: Every read and write operation requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Unit Scope Enforcement**: Every `ActivityReport` and `UnitSettings` document MUST have `unitScope == "pkp-pk-tanjung-api"`. All `list` queries on `reports` explicitly enforce `resource.data.unitScope == "pkp-pk-tanjung-api"`.
4. **Path Variable Hardening**: Every single-document target (`get`, `create`, `update`, `delete`) validates document IDs via `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
5. **Identity Integrity & Immutability**:
   - On `reports` create: `createdByUid == request.auth.uid` and `updatedByUid == request.auth.uid`.
   - On `reports` update: `createdByUid`, `createdByName`, `createdAt`, and `unitScope` are strictly immutable; `updatedByUid == request.auth.uid`.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
7. **PII Isolation**: User emails reside exclusively in `/users/{userId}` with strict `request.auth.uid == userId` access. Shared `/reports` and `/unitSettings` contain zero PII emails.
8. **Payload Size & Schema Strictness**: Every string field enforces `.size() <= maxLength` verbatim from `firebase-blueprint.json`; `hasAll` and `hasOnly` reject ghost/shadow fields; `placePresets` array is bounded to `<= 15` items and validates element types.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Read/Write**: Unauthenticated request attempting `get`/`list`/`create` on `/reports/rep-001`.
2. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create or read `/reports/rep-001`.
3. **Identity Spoofing on Create**: User `uid-A` creating `/reports/rep-002` with `createdByUid: "uid-B"`.
4. **Shadow/Ghost Field Injection on Create**: Creating `/reports/rep-003` with all valid fields plus an extra `"isAdmin": true` ghost field.
5. **Shadow/Ghost Field Injection on Update**: Updating `/reports/rep-001` with `"approvedBySystem": true`.
6. **Immutable Creator Tampering**: Updating `/reports/rep-001` to alter `createdByUid` or `createdAt`.
7. **Client Timestamp Forgery**: Creating `/reports/rep-004` with a backdated client timestamp instead of `request.time`.
8. **ID Poisoning / Resource Exhaustion**: Writing to `/reports/` with a 500-char ID or special characters `../admin`.
9. **Oversized Collage Payload Poisoning**: Creating `/reports/rep-005` with `documentationImage` exceeding 600,000 characters.
10. **Invalid Date Format Value Poisoning**: Updating `reportDateIso` to `"not-a-date"` or a boolean `true`.
11. **Cross-User PII Leak**: User `uid-A` attempting `get` or `list` on `/users/uid-B`.
12. **Unbounded Array Poisoning**: Updating `/unitSettings/pkp-pk-tanjung-api` with `placePresets` containing 25 elements or non-string entries `[123]`.
