/**
 * Stand-in for `next-intl/server` in component tests: `getTranslations` echoes
 * the key, `getFormatter` prints numbers plainly and the locale is English. `bun test` keeps one mock
 * per module for the whole run, so every test that mocks the module must give
 * it the same shape; a file that mocked only `getTranslations` made the next
 * one fail to link `getFormatter`, depending on the order the files ran in.
 */
export const intlServerMock = {
	getTranslations: async () => (key: string) => key,
	getLocale: async () => "en",
	getMessages: async () => ({ nav: {}, queue: {}, auth: {}, error: {} }),
	getFormatter: async () => ({ number: (value: number) => String(value) }),
};
