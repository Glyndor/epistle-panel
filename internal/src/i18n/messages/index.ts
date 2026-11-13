import type { Locale } from "@/i18n/locales";

/**
 * Namespaces of the message catalog. Each one is a JSON file per locale at
 * `./<locale>/<namespace>.json`; the file holds the keys under that namespace.
 */
export const NAMESPACES = [
	"dashboard",
	"nav",
	"domains",
	"accounts",
	"accountDetail",
	"queue",
	"suppression",
	"deliveries",
	"auth",
	"notFound",
	"error",
	"table",
	"mail",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/**
 * Namespaces the client components read through `useTranslations`. Only these
 * reach the browser: the provider in the root layout receives this subset, so
 * the strings the server pages render alone are not serialized into the page.
 * A namespace used by a client component but missing here renders its English
 * fallback or the raw key, which `index.test.ts` catches by scanning the source.
 */
export const CLIENT_NAMESPACES = [
	"dashboard",
	"nav",
	"domains",
	"accounts",
	"accountDetail",
	"queue",
	"suppression",
	"deliveries",
	"auth",
	"error",
	"table",
] as const satisfies readonly Namespace[];
export type ClientNamespace = (typeof CLIENT_NAMESPACES)[number];

/** Keep only the {@link CLIENT_NAMESPACES} of a loaded catalog. */
export function pickClientMessages<M extends Record<ClientNamespace, unknown>>(
	messages: M,
): Pick<M, ClientNamespace> {
	return Object.fromEntries(
		CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]),
	) as Pick<M, ClientNamespace>;
}

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
