/**
 * Security Rules Specification Verification Suite (Dirty Dozen)
 * Verifies data invariants and adversarial payload rejection against firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  violatedInvariant: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read/write on reports',
    targetPath: '/reports/rep-001',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'isVerifiedUser() requires request.auth != null',
  },
  {
    id: 2,
    name: 'Unverified email spoof',
    targetPath: '/reports/rep-001',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Identity spoofing createdByUid on create',
    targetPath: '/reports/rep-002',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'incoming().createdByUid == request.auth.uid',
  },
  {
    id: 4,
    name: 'Shadow ghost field injection on create (isAdmin)',
    targetPath: '/reports/rep-003',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'isValidActivityReport enforces data.keys().hasOnly(...)',
  },
  {
    id: 5,
    name: 'Shadow ghost field injection on update',
    targetPath: '/reports/rep-001',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'affectedKeys().hasOnly(...) and isValidActivityReport',
  },
  {
    id: 6,
    name: 'Immutable createdByUid / createdAt tampering',
    targetPath: '/reports/rep-001',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'incoming().createdByUid == existing().createdByUid && incoming().createdAt == existing().createdAt',
  },
  {
    id: 7,
    name: 'Backdated client timestamp forgery',
    targetPath: '/reports/rep-004',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 8,
    name: 'Document ID poisoning with invalid chars or length > 128',
    targetPath: '/reports/invalid..id!@#',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'isValidId(reportId) regex ^[a-zA-Z0-9_\\-]+$ and <= 128',
  },
  {
    id: 9,
    name: 'Oversized collage payload (> 600000 chars)',
    targetPath: '/reports/rep-005',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'data.documentationImage.size() <= 600000',
  },
  {
    id: 10,
    name: 'Invalid reportDateIso format or boolean poisoning',
    targetPath: '/reports/rep-001',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'data.reportDateIso is string && matches ^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
  },
  {
    id: 11,
    name: 'Cross-user PII profile read (/users/otherUid)',
    targetPath: '/users/other-uid',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'isOwner(userId) enforces strict PII isolation',
  },
  {
    id: 12,
    name: 'Unbounded placePresets array (> 15) or non-string element',
    targetPath: '/unitSettings/pkp-pk-tanjung-api',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    violatedInvariant: 'data.placePresets is list && size() <= 15 && element string guard',
  },
];
