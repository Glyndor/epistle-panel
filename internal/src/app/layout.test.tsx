import { beforeEach, describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { loadMessages } from "@/i18n/messages";
import { installNextIntlMocks, intl, resetIntl } from "@/test/next-intl";

// Put the plain stand-ins back in case another file overrode one of them
// before the layout is first imported.
installNextIntlMocks();

const { default: RootLayout, generateMetadata } = await import("./layout");

beforeEach(async () => {
	resetIntl();
	intl.messages = await loadMessages("en");
});

async function renderLayout(): Promise<string> {
	return renderToStaticMarkup(
		await RootLayout({ children: <main id="main-content">content</main> }),
	);
}

describe("generateMetadata", () => {
	it("tells every crawler to stay out", async () => {
		const metadata = await generateMetadata();

		expect(metadata.robots).toEqual({
			index: false,
			follow: false,
			noarchive: true,
			nosnippet: true,
			noimageindex: true,
		});
	});

	it("names the page after the brand, and uses the operator's favicon only when one is set", async () => {
		expect((await generateMetadata()).title).toBe("Epistle");
		expect(await generateMetadata()).not.toHaveProperty("icons");

		process.env["EPISTLE_PANEL_BRAND_NAME"] = "Acme Mail";
		process.env["EPISTLE_PANEL_BRAND_FAVICON_FILE"] = "/run/favicon.ico";
		const metadata = await generateMetadata();
		delete process.env["EPISTLE_PANEL_BRAND_NAME"];
		delete process.env["EPISTLE_PANEL_BRAND_FAVICON_FILE"];

		expect(metadata.title).toBe("Acme Mail");
		expect(metadata.icons).toEqual({ icon: "/brand/favicon" });
	});

	it("carries no description, canonical link, Open Graph, Twitter or sitemap metadata", async () => {
		const metadata = await generateMetadata();

		for (const key of [
			"description",
			"alternates",
			"openGraph",
			"twitter",
			"verification",
			"appLinks",
		] as const) {
			expect(metadata).not.toHaveProperty(key);
		}
	});
});

describe("RootLayout", () => {
	it("renders the page inside an html element in the request's locale", async () => {
		for (const locale of SUPPORTED_LOCALES) {
			intl.locale = locale;

			const html = await renderLayout();

			expect(html).toStartWith(`<html lang="${locale}"`);
			expect(html).toContain('<main id="main-content">content</main>');
		}
	});

	it("links the operator's stylesheet only when one is configured", async () => {
		expect(await renderLayout()).not.toContain("/theme.css");

		process.env["EPISTLE_PANEL_THEME_CSS_FILE"] = "/run/theme.css";
		const html = await renderLayout();
		delete process.env["EPISTLE_PANEL_THEME_CSS_FILE"];

		expect(html).toContain('href="/theme.css"');
		expect(html).toContain('rel="stylesheet"');
	});

	it("renders no navigation of its own: the shell lives in the (admin) layout", async () => {
		const html = await renderLayout();

		expect(html).not.toContain("<nav");
		expect(html).not.toContain('href="#main-content"');
	});

	it("gives the client provider only the namespaces client components read", async () => {
		await renderLayout();

		expect(Object.keys(intl.providerMessages ?? {}).sort()).toEqual([
			"accountDetail",
			"accounts",
			"auth",
			"confirm",
			"dashboard",
			"deliveries",
			"domains",
			"error",
			"mail",
			"nav",
			"queue",
			"suppression",
			"table",
		]);
	});
});
