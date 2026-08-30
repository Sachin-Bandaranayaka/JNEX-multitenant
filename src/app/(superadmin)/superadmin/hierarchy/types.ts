export type HierarchyTenant = { id: string; name: string; businessName: string | null; isActive: boolean; referredById: string | null };
export type TransferHistoryItem = { id: string; createdAt: string; memberName: string; fromName: string | null; toName: string | null; reason: string | null; actorName: string };
export type TransferResult = { ok: true; message: string } | { ok: false; message: string };
