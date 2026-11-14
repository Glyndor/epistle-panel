import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { Component, type ReactNode } from "react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { UserMenuPanel } = await import(".");

const root = () => document.documentElement;
const writes = (name: string) => cookies.writes.filter((w) => w.name === name);
const originalGet = cookies.jar.get.bind(cookies.jar);

beforeEach(() => {
	resetIntl();
	cookies.reset();
	cookies.jar.get = originalGet;
});
afterEach(() => {
	cleanup();
	clearToasts();
	root().removeAttribute("data-theme");
});

/** Keeps what a child threw, as Next's own boundary keeps a redirect. */
class Catch extends Component<
	{ children: ReactNode; seen: (error: unknown) => void },
	{ failed: boolean }
> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override componentDidCatch(error: unknown) {
		this.props.seen(error);
	}
	override render() {
		return this.state.failed ? null : this.props.children;
	}
}

function renderPanel(
	props: {
		name?: string;
		sessionRole?: "admin" | "user";
		adminHref?: string;
		defaultOpen?: boolean;
	} = {},
	seen: (error: unknown) => void = () => {},
) {
	return render(
		<Catch seen={seen}>
			<UserMenuPanel
				name={props.name ?? "ana"}
				sessionRole={props.sessionRole ?? "user"}
				adminHref={props.adminHref}
				defaultOpen={props.defaultOpen ?? true}
			/>
			<Toaster label="toasts" closeLabel="close" />
		</Catch>,
	);
}

describe("UserMenuPanel", () => {
	it("starts closed, or open when asked to", async () => {
		renderPanel({ defaultOpen: false });
		expect(screen.queryByRole("menu")).toBeNull();
		expect(screen.getByRole("button", { name: "account" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		cleanup();

		renderPanel();
		expect(await screen.findByRole("menu")).toBeInTheDocument();
	});

	it("says who is signed in and as what, and nothing the server did not give", async () => {
		renderPanel({ name: "jose.caro", sessionRole: "user" });

		const menu = await screen.findByRole("menu");
		expect(menu).toHaveTextContent("jose.caro");
		expect(menu).toHaveTextContent("role_user");
		expect(menu).not.toHaveTextContent("role_admin");
		expect(menu.querySelector("img")).toBeNull();
		cleanup();

		renderPanel({ name: "ops", sessionRole: "admin" });
		expect(await screen.findByRole("menu")).toHaveTextContent("role_admin");
	});

	it("offers the language and the theme as two named groups of radio items", async () => {
		renderPanel();
		await screen.findByRole("menu");

		const language = screen.getByRole("group", { name: "language" });
		expect(
			within(language)
				.getAllByRole("menuitemradio")
				.map((item) => item.textContent),
		).toEqual(SUPPORTED_LOCALES.map((code) => LOCALE_NAMES[code]));
		const theme = screen.getByRole("group", { name: "theme" });
		expect(
			within(theme)
				.getAllByRole("menuitemradio")
				.map((item) => item.textContent),
		).toEqual(["theme_system", "theme_light", "theme_dark"]);
	});

	it("offers the way into the administration only when the server gave one", async () => {
		renderPanel({ sessionRole: "user" });
		await screen.findByRole("menu");
		expect(
			screen.queryByRole("menuitem", { name: "administration" }),
		).toBeNull();
		expect(
			screen.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["logout"]);
		cleanup();

		renderPanel({ sessionRole: "admin", adminHref: "/app/abc" });
		await screen.findByRole("menu");
		const link = screen.getByRole("menuitem", { name: "administration" });
		expect(link.tagName).toBe("A");
		expect(link).toHaveAttribute("href", "/app/abc");
	});

	it("does not invent the way in from the role alone", async () => {
		// An admin session in an installation whose admin area is off.
		renderPanel({ sessionRole: "admin" });
		await screen.findByRole("menu");

		expect(
			screen.queryByRole("menuitem", { name: "administration" }),
		).toBeNull();
		expect(document.querySelector("a")).toBeNull();
	});

	it("stores a picked language through the Server Action", async () => {
		await cookies.signIn();
		renderPanel();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "Deutsch" }),
		);

		await waitFor(() =>
			expect(writes("locale").map((w) => w.value)).toEqual(["de"]),
		);
	});

	it("shows a picked theme at once and stores it", async () => {
		await cookies.signIn();
		renderPanel();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_dark" }),
		);

		expect(root().getAttribute("data-theme")).toBe("dark");
		await waitFor(() =>
			expect(writes("theme").map((w) => w.value)).toEqual(["dark"]),
		);
	});

	it("checks the theme another control of the page set", async () => {
		renderPanel();
		const dark = await screen.findByRole("menuitemradio", {
			name: "theme_dark",
		});
		expect(dark).toHaveAttribute("aria-checked", "false");

		// The header's theme button changes the same attribute.
		root().setAttribute("data-theme", "dark");

		await waitFor(() =>
			expect(dark).toHaveAttribute("aria-checked", "true"),
		);
	});

	it("signs out through the logout action: the session cookie is expired and the page leaves for the sign-in page", async () => {
		await cookies.signIn();
		const seen: unknown[] = [];
		renderPanel({}, (error) => seen.push(error));

		fireEvent.click(
			await screen.findByRole("menuitem", { name: "logout" }),
		);

		await waitFor(() => expect(seen).toHaveLength(1));
		expect(seen[0]).toBeInstanceOf(RedirectSignal);
		expect((seen[0] as RedirectSignal).target).toBe("/");
		const [write] = writes("__Host-epistle_session");
		expect(write?.value).toBe("");
		expect(write?.options).toMatchObject({ maxAge: 0 });
	});

	it("says the person is still signed in, and keeps the page, when signing out cannot be reached", async () => {
		await cookies.signIn();
		const seen: unknown[] = [];
		renderPanel({}, (error) => seen.push(error));
		cookies.jar.get = () => {
			throw new Error("the request failed");
		};

		fireEvent.click(
			await screen.findByRole("menuitem", { name: "logout" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"logoutFailed",
		);
		// Nothing reached the boundary: the page is the one the person was on.
		expect(seen).toEqual([]);
		expect(writes("__Host-epistle_session")).toEqual([]);
		const button = screen.getByRole("button", { name: "account" });
		await waitFor(() =>
			expect(button).not.toHaveAttribute("aria-busy", "true"),
		);
	});

	it("ends the session once: while it is on its way the rows wait and a second press sends nothing", async () => {
		await cookies.signIn();
		const seen: unknown[] = [];
		// The action checks the session token first. Held there, sign out is
		// on its way for as long as the case needs to look.
		const verify = crypto.subtle.verify.bind(crypto.subtle);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const held = spyOn(crypto.subtle, "verify").mockImplementation(
			async (...args: Parameters<typeof verify>) => {
				await gate;
				return verify(...args);
			},
		);
		try {
			renderPanel({ adminHref: "/app/abc", sessionRole: "admin" }, (e) =>
				seen.push(e),
			);
			fireEvent.click(
				await screen.findByRole("menuitem", { name: "logout" }),
			);
			const button = screen.getByRole("button", { name: "account" });
			await waitFor(() =>
				expect(button).toHaveAttribute("aria-busy", "true"),
			);

			// Opened again while the first press is still on its way.
			fireEvent.keyDown(button, { key: "Enter" });
			const again = await screen.findByRole("menuitem", {
				name: "logout",
			});
			expect(again).toHaveAttribute("data-disabled");
			for (const row of screen.getAllByRole("menuitemradio")) {
				expect(row).toHaveAttribute("data-disabled");
			}
			fireEvent.click(again);
			await Promise.resolve();
			expect(held).toHaveBeenCalledTimes(1);
		} finally {
			release();
		}

		await waitFor(() => expect(seen).toHaveLength(1));
		held.mockRestore();
		expect(seen[0]).toBeInstanceOf(RedirectSignal);
		expect(writes("__Host-epistle_session")).toHaveLength(1);
	});

	it("keeps the list inside the window: no wider than it, and scrolling inside when it is short", async () => {
		renderPanel();

		const menu = await screen.findByRole("menu");
		expect(menu).toHaveClass(
			"max-w-[calc(100vw-1rem)]",
			"overflow-y-auto",
			"max-h-(--radix-dropdown-menu-content-available-height)",
		);
		expect(menu.querySelector("[style*='width']")).toBeNull();
	});
});
