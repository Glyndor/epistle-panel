import { beforeEach, describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

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

	it("takes the title from the app namespace and carries no description, canonical link, Open Graph, Twitter or sitemap metadata", async () => {
		const metadata = await generateMetadata();

		expect(metadata.title).toBe("title");
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
		intl.locale = "es";

		const html = await renderLayout();

		expect(html).toStartWith('<html lang="es"');
		expect(html).toContain('<main id="main-content">content</main>');
	});

	it("renders no navigation of its own: the shell lives in the (app) layout", async () => {
		const html = await renderLayout();

		expect(html).not.toContain("<nav");
		expect(html).not.toContain('href="#main-content"');
	});

	it("gives the client provider only the namespaces client components read", async () => {
		await renderLayout();

		expect(Object.keys(intl.providerMessages ?? {}).sort()).toEqual([
			"auth",
			"error",
			"nav",
			"queue",
		]);
	});
});
