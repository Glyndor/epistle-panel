import { z } from "zod";

/** `GET /api/v1/domains` */
export const domainsSchema = z.object({
	domains: z.array(z.string()),
	/**
	 * The domains above that are switched off and take no mail. A server that
	 * leaves the field out is read as having none switched off.
	 */
	disabled: z.array(z.string()).optional(),
});
export type Domains = z.infer<typeof domainsSchema>;
