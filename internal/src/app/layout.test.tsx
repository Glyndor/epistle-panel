import { beforeEach, describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { loadMessages } from "@/i18n/messages";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { installNextIntlMocks, intl, resetIntl } from "@/test/next-intl";

// A client-component test elsewhere may have mocked next-intl with fewer
// exports; put the full stand-in back before the layout is first imported.
installNextIntlMocks();
const cookies = mockRequestCookies();

const { default: RootLayout, generateMetadata } = await import("./layout");

beforeEach(async () => {
	resetIntl();
	cookies.reset();
	intl.messages = await loadMessages("en");
});

async function renderLayout(): Promise<string> {
	return renderToStaticMarkup(
		await RootLayout({ children: <main id="main-content">content</main> }),
	);
}

describe("generateMetadata", () => {
	it("takes the title and the description from the app namespace", async () => {
		expect(await generateMetadata()).toEqual({
			title: "title",
			description: "description",
		});
	});
});

describe("RootLayout", () => {
	it("renders the page inside an html element in the request's locale", async () => {
		intl.locale = "es";

		const html = await renderLayout();

		expect(html).toStartWith('<html lang="es"');
		expect(html).toContain('<main id="main-content">content</main>');
	});

	it("shows the skip link and the navigation to a signed-in admin", async () => {
		await cookies.signIn();

		const html = await renderLayout();

		expect(html).toContain('href="#main-content"');
		expect(html).toContain(">skip</a>");
		expect(html).toContain("<nav");
	});

	it("shows neither the skip link nor the navigation without a session", async () => {
		const html = await renderLayout();

		expect(html).not.toContain('href="#main-content"');
		expect(html).not.toContain("<nav");
		expect(html).toContain('<main id="main-content">content</main>');
	});

	it("shows nothing of the panel to a forged session cookie", async () => {
		cookies.jar.set(SESSION_COOKIE, "forged.token");

		expect(await renderLayout()).not.toContain("<nav");
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
