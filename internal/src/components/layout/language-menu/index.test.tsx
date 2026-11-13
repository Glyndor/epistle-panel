import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { LanguageMenu } = await import(".");

beforeEach(() => {
	// Another file may have left the stand-in's locale on `es`.
	resetIntl();
	cookies.reset();
});
afterEach(cleanup);

function renderMenu(props: { defaultOpen?: boolean } = {}) {
	return render(
		<SidebarProvider>
			<LanguageMenu defaultOpen={false} {...props} />
		</SidebarProvider>,
	);
}

describe("LanguageMenu", () => {
	it("starts closed, or open when asked to", async () => {
		renderMenu();
		expect(screen.queryByRole("menu")).toBeNull();
		cleanup();

		renderMenu({ defaultOpen: true });
		expect(await screen.findByRole("menu")).toBeInTheDocument();
	});

	it("lists every shipped language by its own name, the current one checked", async () => {
		renderMenu({ defaultOpen: true });

		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((item) => item.getAttribute("lang"))).toEqual([
			...SUPPORTED_LOCALES,
		]);
		expect(items.map((item) => item.textContent)).toEqual(
			SUPPORTED_LOCALES.map((code) => LOCALE_NAMES[code]),
		);
		expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(
			SUPPORTED_LOCALES.map((code) => String(code === "en")),
		);
	});

	it("stores the chosen language through the Server Action for a signed-in admin", async () => {
		await cookies.signIn();
		renderMenu({ defaultOpen: true });

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "Español" }),
		);

		await waitFor(() => {
			expect(
				cookies.writes.some(
					(w) => w.name === "locale" && w.value === "es",
				),
			).toBe(true);
		});
	});

	it("does nothing when the current language is picked again", async () => {
		await cookies.signIn();
		renderMenu({ defaultOpen: true });

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "English" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(cookies.writes).toEqual([]);
	});
});
