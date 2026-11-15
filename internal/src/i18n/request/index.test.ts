import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { loadMessages } from "@/i18n/messages";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { DEFAULT_LOCALE_VARIABLE } from "@/lib/config/default-locale";
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

/** What a request carries: the person's own choice, the browser and the operator. */
interface Request {
	locale?: string;
	acceptLanguage?: string;
	operatorDefault?: string;
}

/** The configuration the request resolves to, with `locale` as the cookie. */
async function resolve(request: Request = {}): Promise<Config> {
	cookies.reset();
	delete process.env[DEFAULT_LOCALE_VARIABLE];
	if (request.locale !== undefined) {
		cookies.jar.set("locale", request.locale);
	}
	if (request.acceptLanguage !== undefined) {
		cookies.requestHeaders.set("accept-language", request.acceptLanguage);
	}
	if (request.operatorDefault !== undefined) {
		process.env[DEFAULT_LOCALE_VARIABLE] = request.operatorDefault;
	}
	// The stand-in returns the config function itself, as `getRequestConfig`
	// does at runtime before Next calls it per request.
	return (await (
		requestConfig as unknown as () => Promise<Config>
	)()) as Config;
}

beforeEach(() => {
	cookies.reset();
	delete process.env[DEFAULT_LOCALE_VARIABLE];
});

afterEach(() => {
	delete process.env[DEFAULT_LOCALE_VARIABLE];
});

describe("locale resolution", () => {
	it("defaults to English without a locale cookie", async () => {
		const config = await resolve();

		expect(config.locale).toBe("en");
		expect(config.messages).toEqual(await loadMessages("en"));
	});

	it("serves each shipped locale's own catalog for its cookie", async () => {
		const english = await loadMessages("en");
		for (const locale of SUPPORTED_LOCALES) {
			const config = await resolve({ locale });

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
			const config = await resolve({ locale: value });

			expect(config.locale).toBe("en");
			expect(config.messages).toEqual(await loadMessages("en"));
		}
	});

	it("serves the language the browser asked for when the cookie holds nothing", async () => {
		const config = await resolve({ acceptLanguage: "de,en;q=0.8" });

		expect(config.locale).toBe("de");
		expect(config.messages).toEqual(await loadMessages("de"));
	});

	it("serves the operator's default when the browser asked for nothing", async () => {
		const config = await resolve({ operatorDefault: "it" });

		expect(config.locale).toBe("it");
		expect(config.messages).toEqual(await loadMessages("it"));
	});

	it("keeps the person's own choice ahead of the browser and the operator", async () => {
		const config = await resolve({
			locale: "es",
			acceptLanguage: "de",
			operatorDefault: "it",
		});

		expect(config.locale).toBe("es");
		expect(config.messages).toEqual(await loadMessages("es"));
	});

	it("keeps the browser ahead of the operator's default", async () => {
		const config = await resolve({
			acceptLanguage: "de",
			operatorDefault: "it",
		});

		expect(config.locale).toBe("de");
	});
});

describe("missing messages", () => {
	it("answers a key missing from the active locale with its English string", async () => {
		const config = await resolve({ locale: "es" });
		const english = (await loadMessages("en")).notFound[
			"heading"
		] as string;

		expect(config.getMessageFallback({ key: "notFound.heading" })).toBe(
			english,
		);
	});

	it("answers a key English does not have with the key itself", async () => {
		const config = await resolve({ locale: "es" });

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
		const config = await resolve({ locale: "es" });

		expect(() =>
			config.onError(new Error("MISSING_MESSAGE")),
		).not.toThrow();
	});
});
