/**
 * The rows `POST /__control/seed` adds to the stand-in's lists, so a scenario
 * can look at a list longer than one page. Nothing here is a secret.
 */

/** Most rows one call adds to a list. */
const MAX_SEED = 500;

/** What the control path answers to a body it does not take. */
export const SEED_ERROR = "accounts and domains must be integers from 0 to 500";

/** The domain the stand-in hosts from the start. */
export const SEED_DOMAIN = "example.test";

/** One seeded domain and whether it stands for one the server has switched off. */
export interface SeededDomain {
	name: string;
	disabled: boolean;
}

const isCount = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= MAX_SEED;

/**
 * The counts of a seed request, each 0 when left out, or `null` when one of
 * them is not a whole number from 0 to 500.
 */
export function parseSeed(
	body: unknown,
): { accounts: number; domains: number } | null {
	const { accounts = 0, domains = 0 } = (body ?? {}) as {
		accounts?: unknown;
		domains?: unknown;
	};
	return isCount(accounts) && isCount(domains) ? { accounts, domains } : null;
}

/**
 * `count` more hosted domains, `d001.example.test` onwards. Every third one is
 * switched off.
 */
export function seededDomains(count: number): SeededDomain[] {
	return Array.from({ length: count }, (_, index) => ({
		name: `d${String(index + 1).padStart(3, "0")}.${SEED_DOMAIN}`,
		disabled: (index + 1) % 3 === 0,
	}));
}
