import { beforeEach, describe, expect, it } from "bun:test";

import { loadMessages } from "@/i18n/messages";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { installNextIntlMocks } from "@/test/next-intl";

installNextIntlMocks();
const cookies = mockRequestCookies();

const { default: requestConfig, SUPPORTED_LOCALES } = await import(".");

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
	it("supports English and Spanish", () => {
		expect([...SUPPORTED_LOCALES]).toEqual(["en", "es"]);
	});

	it("defaults to English without a locale cookie", async () => {
		const config = await resolve();

		expect(config.locale).toBe("en");
		expect(config.messages).toEqual(await loadMessages("en"));
	});

	it("serves the Spanish catalog for the es cookie", async () => {
		const config = await resolve("es");

		expect(config.locale).toBe("es");
		expect(config.messages).toEqual(await loadMessages("es"));
		expect(config.messages).not.toEqual(await loadMessages("en"));
	});

	it("falls back to English for a locale it does not ship", async () => {
		for (const value of ["fr", "EN", "es-CO", "", "../en"]) {
			const config = await resolve(value);

			expect(config.locale).toBe("en");
			expect(config.messages).toEqual(await loadMessages("en"));
		}
	});
});

describe("missing messages", () => {
	it("answers a key missing from the active locale with its English string", async () => {
		const config = await resolve("es");
		const english = (await loadMessages("en")).app.title as string;

		expect(config.getMessageFallback({ key: "app.title" })).toBe(english);
	});

	it("answers a key English does not have with the key itself", async () => {
		const config = await resolve("es");

		expect(config.getMessageFallback({ key: "app.nope" })).toBe("app.nope");
		expect(config.getMessageFallback({ key: "nope.title" })).toBe(
			"nope.title",
		);
		// A path that ends on a branch, not a string, is not a message either.
		expect(config.getMessageFallback({ key: "app" })).toBe("app");
		expect(config.getMessageFallback({ key: "app.title.deeper" })).toBe(
			"app.title.deeper",
		);
	});

	it("swallows the error so a gap does not flood the log", async () => {
		const config = await resolve("es");

		expect(() =>
			config.onError(new Error("MISSING_MESSAGE")),
		).not.toThrow();
	});
});
