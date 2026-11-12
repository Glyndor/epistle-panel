import type { Locale } from "@/i18n/request";

/**
 * Namespaces of the message catalog. Each one is a JSON file per locale at
 * `./<locale>/<namespace>.json`; the file holds the keys under that namespace.
 */
export const NAMESPACES = [
	"app",
	"dashboard",
	"nav",
	"domains",
	"accounts",
	"queue",
	"auth",
	"notFound",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/** Merge the per-namespace files of one locale into a single catalog. */
export async function loadMessages(
	locale: Locale,
): Promise<Record<Namespace, Record<string, unknown>>> {
	const entries = await Promise.all(
		NAMESPACES.map(
			async (namespace) =>
				[
					namespace,
					(await import(`./${locale}/${namespace}.json`)).default,
				] as const,
		),
	);
	return Object.fromEntries(entries) as Record<
		Namespace,
		Record<string, unknown>
	>;
}
