/**
 * Stand-in for `next-intl` in client component tests: `useTranslations` echoes
 * the key, `useLocale` reports English and the provider renders its children. `bun test` keeps one mock per
 * module for the whole run, so every test that mocks `next-intl` must use the
 * same shape, or the result depends on which file ran first.
 */
export const intlClientMock = {
	useTranslations: () => (key: string) => key,
	useLocale: () => "en",
	NextIntlClientProvider: ({ children }: { children?: unknown }) => children,
};
