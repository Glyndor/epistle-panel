import { z } from "zod";

/** The outcomes of a delivery record, as the API names them. */
export const DELIVERY_OUTCOMES = [
	"delivered",
	"deferred",
	"failed",
	"suppressed",
	"canceled",
] as const;
export const deliveryOutcomeSchema = z.enum(DELIVERY_OUTCOMES);
export type DeliveryOutcome = z.infer<typeof deliveryOutcomeSchema>;

/** Latest epoch second the panel formats (the end of year 9999), so a date never fails to print. */
const MAX_EPOCH = 253_402_300_799;

/**
 * `GET /api/v1/deliveries`: no cursor, the API cuts the page at `limit`. The
 * `extra` map a record also carries is not read: the panel does not show it.
 */
export const deliveriesSchema = z.object({
	entries: z.array(
		z.object({
			time: z.number().int().min(0).max(MAX_EPOCH),
			spool_id: z.uuid(),
			account: z.string().nullable(),
			from: z.string(),
			recipient: z.string(),
			outcome: deliveryOutcomeSchema,
			remote: z.string().nullable(),
			reply: z.string().nullable(),
			attempt: z.number().int().min(0),
		}),
	),
});
export type Deliveries = z.infer<typeof deliveriesSchema>;
