/**
 * The stand-in for `next/navigation`, whose server pieces do not resolve under
 * `bun test`, with every export the panel imports and the ones a test is
 * likely to reach for.
 *
 * `mock.module` is process-global: a file that mocked this module with only
 * the exports it used (`usePathname` and `redirect`) left every file that ran
 * after it without `notFound` (`Export named 'notFound' not found`, seen under
 * `bun test --randomize`). The preload registers this stand-in with the
 * wrapper of `src/test/next-intl`, so a file's own mock keeps its exports and
 * the rest come from here: no file can leave a name out any more.
 */
export function navigationStandIn() {
	return {
		redirect: () => {
			throw new Error("NEXT_REDIRECT");
		},
		notFound: () => {
			throw new Error("NEXT_NOT_FOUND");
		},
		usePathname: () => "/",
		useRouter: () => ({
			push: () => {},
			replace: () => {},
			refresh: () => {},
		}),
		useSearchParams: () => new URLSearchParams(),
	};
}

/** The stand-in for `next/headers`: a request with no cookie. */
export function headersStandIn() {
	return {
		cookies: async () => ({
			get: () => undefined,
			set: () => {},
			delete: () => {},
		}),
		headers: async () => new Headers(),
	};
}
