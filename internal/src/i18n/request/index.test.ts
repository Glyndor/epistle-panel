import { beforeEach, describe, expect, it } from "bun:test";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { loadMessages } from "@/i18n/messages";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { installNextIntlMocks } from "@/test/next-intl";

installNextIntlMocks();
const cookies = mockRequestCookies();

const { default: requestConfig } = await import(".");

type Config = {
	locale: string;
	messages: unknown;
	getMessageFallback: (info: { key: string }) => string;
	onError: (error: unknown) => unknown;
};

/** The configuration the request resolves to, with `locale` as the cookie. */
async function resolve(locale?: string): Promise<Config> {
	cookies.reset();
	if (locale !== undefined) {
		cookies.jar.set("locale", locale);
	}
	// The stand-in returns the config function itself, as `getRequestConfig`
	// does at runtime before Next calls it per request.
	return (await (
		requestConfig as unknown as () => Promise<Config>
	)()) as Config;
}

beforeEach(() => cookies.reset());

describe("locale resolution", () => {
	it("defaults to English without a locale cookie", async () => {
		const config = await resolve();

		expect(config.locale).toBe("en");
		expect(config.messages).toEqual(await loadMessages("en"));
	});

	it("serves each shipped locale's own catalog for its cookie", async () => {
		const english = await loadMessages("en");
		for (const locale of SUPPORTED_LOCALES) {
			const config = await resolve(locale);

			expect(config.locale).toBe(locale);
			expect(config.messages).toEqual(await loadMessages(locale));
			if (locale !== "en") {
				expect(config.messages).not.toEqual(english);
			}
		}
	});

	it("falls back to English for a locale it does not ship", async () => {
		for (const value of [
			"ja",
			"EN",
			"ES",
			"es-CO",
			"pt-BR",
			"",
			"../en",
			"__proto__",
		]) {
			const config = await resolve(value);

			expect(config.locale).toBe("en");
			expect(config.messages).toEqual(await loadMessages("en"));
		}
	});
});

describe("missing messages", () => {
	it("answers a key missing from the active locale with its English string", async () => {
		const config = await resolve("es");
		const english = (await loadMessages("en")).notFound[
			"heading"
		] as string;

		expect(config.getMessageFallback({ key: "notFound.heading" })).toBe(
			english,
		);
	});

	it("answers a key English does not have with the key itself", async () => {
		const config = await resolve("es");

		expect(config.getMessageFallback({ key: "notFound.nope" })).toBe(
			"notFound.nope",
		);
		expect(config.getMessageFallback({ key: "nope.title" })).toBe(
			"nope.title",
		);
		// A path that ends on a branch, not a string, is not a message either.
		expect(config.getMessageFallback({ key: "notFound" })).toBe("notFound");
		expect(
			config.getMessageFallback({ key: "notFound.heading.deeper" }),
		).toBe("notFound.heading.deeper");
	});

	it("swallows the error so a gap does not flood the log", async () => {
		const config = await resolve("es");

		expect(() =>
			config.onError(new Error("MISSING_MESSAGE")),
		).not.toThrow();
	});
});
