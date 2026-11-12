import { z } from "zod";

/** `GET /api/v1/domains` */
export const domainsSchema = z.object({
	domains: z.array(z.string()),
});
export type Domains = z.infer<typeof domainsSchema>;
