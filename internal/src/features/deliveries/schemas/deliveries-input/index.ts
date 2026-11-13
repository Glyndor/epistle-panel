import { z } from "zod";

import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { mailAddressSchema } from "@/lib/mail-address";

/** Most records the panel asks for: the API's own ceiling, since it has no cursor. */
export const DELIVERIES_LIMIT = 100;

/**
 * How far back to look, as the API reads it: a count of seconds, minutes, hours
 * or days. The API also takes an RFC 3339 timestamp; the panel offers durations
 * only, so a value is a short fixed shape.
 */
export const SINCE_VALUES = ["15m", "1h", "24h", "7d", "30d"] as const;
const sinceSchema = z.enum(SINCE_VALUES);

/**
 * The filters of the delivery log. Strict, so nothing the client adds reaches
 * the API call. Every field is optional: no filter means the newest records.
 */
export const deliveryFiltersSchema = z.strictObject({
	outcome: z.enum(DELIVERY_OUTCOMES).optional(),
	since: sinceSchema.optional(),
	recipient: mailAddressSchema.optional(),
});
export type DeliveryFilters = z.infer<typeof deliveryFiltersSchema>;

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

/**
 * Read the filters from a page's query parameters. Each field is checked on its
 * own and one that is not valid is dropped, so a bad `since` does not discard a
 * good `outcome`. Next hands a repeated parameter over as an array: the first
 * value counts. The result is built in a fixed order, so it is also a stable
 * cache key.
 */
export function parseFilterParams(params: {
	outcome?: string | string[];
	since?: string | string[];
	recipient?: string | string[];
}): DeliveryFilters {
	const filters: DeliveryFilters = {};
	const outcome = deliveryFiltersSchema.shape.outcome.safeParse(
		first(params.outcome),
	);
	if (outcome.success && outcome.data !== undefined) {
		filters.outcome = outcome.data;
	}
	const since = deliveryFiltersSchema.shape.since.safeParse(
		first(params.since),
	);
	if (since.success && since.data !== undefined) {
		filters.since = since.data;
	}
	const recipient = deliveryFiltersSchema.shape.recipient.safeParse(
		first(params.recipient),
	);
	if (recipient.success && recipient.data !== undefined) {
		filters.recipient = recipient.data;
	}
	return filters;
}
