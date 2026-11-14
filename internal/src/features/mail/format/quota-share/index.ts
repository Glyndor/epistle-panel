import type { QuotaView } from "@/features/mail/schemas/mail-view";

/** From this share of the limit on, the meter says the storage is nearly full. */
export const QUOTA_NEAR = 0.9;

/**
 * How full the storage is, for a meter and for the words beside it.
 * - `unlimited`: the account has no limit, so there is no share to show.
 * - `ok`, `near` (from {@link QUOTA_NEAR} of the limit), `full` (at or over it).
 */
export type QuotaLevel = "unlimited" | "ok" | "near" | "full";

export interface QuotaShare {
	readonly level: QuotaLevel;
	/** What is used over the limit, from 0 to 1 (more than the limit is 1). `null` with no limit. */
	readonly share: number | null;
}

/** How full `quota` is. Usage over the limit reads as full, never as more than all of it. */
export function quotaShare(quota: QuotaView): QuotaShare {
	if (quota.limit === null || quota.limit <= 0) {
		return { level: "unlimited", share: null };
	}
	const share = Math.min(1, Math.max(0, quota.used / quota.limit));
	return {
		level: share >= 1 ? "full" : share >= QUOTA_NEAR ? "near" : "ok",
		share,
	};
}
