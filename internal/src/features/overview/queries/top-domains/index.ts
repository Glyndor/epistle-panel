import { sharesPerMille } from "@/lib/charts/shares";

/** The addresses of one domain, and their share of the ones read in tenths of a percent. */
export interface DomainCount {
	/** The domain in lower case; `null` for every address not under one of the listed domains. */
	readonly domain: string | null;
	readonly count: number;
	readonly share: number;
}

/** Addresses counted by the domain after the `@`. */
export interface TopDomains {
	readonly total: number;
	/** The domains with the most addresses, most first, then the rest as one row when there is a rest. */
	readonly rows: readonly DomainCount[];
}

/** The part after the last `@`, in lower case; `null` when there is no such part. */
function domainOf(address: string): string | null {
	const at = address.lastIndexOf("@");
	const domain = at < 0 ? "" : address.slice(at + 1).toLowerCase();
	return domain === "" ? null : domain;
}

/**
 * Count addresses by domain and keep the `top` domains with the most, most
 * first; two domains with the same count are in alphabetical order, so the
 * list does not change between two reads of the same data. Everything else,
 * an address with no domain included, is one last row with a `null` domain.
 * The shares add up to exactly 1000 when there is at least one address.
 */
export function topDomains(addresses: readonly string[], top = 5): TopDomains {
	const counts = new Map<string, number>();
	let rest = 0;
	for (const address of addresses) {
		const domain = domainOf(address);
		if (domain === null) {
			rest += 1;
		} else {
			counts.set(domain, (counts.get(domain) ?? 0) + 1);
		}
	}
	const ranked = [...counts].sort(
		([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : 1),
	);
	const listed = ranked.slice(0, Math.max(0, top));
	for (const [, count] of ranked.slice(listed.length)) {
		rest += count;
	}
	const rows: [string | null, number][] =
		rest > 0 ? [...listed, [null, rest]] : listed;
	const shares = sharesPerMille(rows.map(([, count]) => count));
	return {
		total: addresses.length,
		rows: rows.map(([domain, count], index) => ({
			domain,
			count,
			share: shares[index] ?? 0,
		})),
	};
}
