import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { LanguageMenu } = await import(".");

beforeEach(() => {
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

	it("lists both languages with the current one checked", async () => {
		renderMenu({ defaultOpen: true });

		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((item) => item.getAttribute("lang"))).toEqual([
			"en",
			"es",
		]);
		expect(items[0]).toHaveAttribute("aria-checked", "true");
		expect(items[1]).toHaveAttribute("aria-checked", "false");
	});

	it("stores the chosen language through the Server Action for a signed-in admin", async () => {
		await cookies.signIn();
		renderMenu({ defaultOpen: true });

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "languageEs" }),
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
			await screen.findByRole("menuitemradio", { name: "languageEn" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(cookies.writes).toEqual([]);
	});
});
