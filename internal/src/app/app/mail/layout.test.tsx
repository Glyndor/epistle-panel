import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "@/components/layout/app-shell";
import { stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { settled, withQuery } from "@/test/query-wrapper";
import { resolveFirstPaint, resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: MailLayout } = await import("./layout");

beforeEach(() => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
});
afterEach(async () => {
	// The folders ask for themselves in the browser when the server gave none.
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

const slots = {
	children: <p>page</p>,
	trail: <nav aria-label="trail">here</nav>,
	search: <p>search</p>,
};

const answers = {
	"Mailbox/get": {
		list: [
			{
				id: "INBOX",
				name: "INBOX",
				role: "inbox",
				totalEmails: 2,
				unreadEmails: 1,
			},
		],
	},
	"Quota/get": {
		list: [
			{
				resourceType: "octets",
				used: 1_000_000_000,
				limit: 4_000_000_000,
			},
		],
	},
};

/**
 * The layout's element is the query provider around an AppShell, whose parts
 * arrive as props: run the shell too, so its server parts are in the tree.
 */
async function shell() {
	const layout = (await MailLayout(slots)) as React.ReactElement<{
		children: React.ReactElement<React.ComponentProps<typeof AppShell>>;
	}>;
	return AppShell(layout.props.children.props);
}

/** The layout with everything it streams resolved. */
async function renderLayout() {
	return render(withQuery(await resolveServerTree(await shell())));
}

describe("MailLayout", () => {
	it("redirects to sign-in without a session, before rendering anything", async () => {
		const outcome = await MailLayout(slots).catch((e) => e);
		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
	});

	it("draws the skip link first, the sidebar, the header and one main landmark with the page", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		expect(screen.getAllByRole("main")).toHaveLength(1);
		expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("page"),
		);
		const first = document.querySelector("a, button, select");
		expect(first).toHaveAttribute("href", "#main-content");
		expect(
			screen.getByRole("complementary", { name: "navTitle" }),
		).toBeInTheDocument();
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "account" }),
		).toHaveTextContent("ana");
	});

	it("leaves the scrolling to the panes of the page: nothing of the frame moves", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		expect(
			document.querySelector("[data-slot='sidebar-wrapper']"),
		).toHaveClass("h-dvh");
		expect(screen.getByRole("main")).toHaveAttribute(
			"data-content",
			"panes",
		);
		expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
	});

	it("draws the trail of its slot in the header, and the search of its slot beside it", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		const banner = screen.getByRole("banner");
		expect(banner).toContainElement(
			screen.getByRole("navigation", { name: "trail" }),
		);
		// The cell of the search is not empty: it holds the search of the
		// area, and the trail does not grow into the place it will take.
		expect(banner).toContainElement(screen.getByText("search"));
		expect(
			banner.querySelector("[data-slot='header-search']"),
		).not.toBeNull();
	});

	it("names the sidebar and the folders inside it differently", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);
		await renderLayout();

		const sidebar = screen.getByRole("complementary");
		const folders = await screen.findByRole("navigation", {
			name: "folders",
		});
		expect(sidebar).toHaveAttribute("aria-label", "navTitle");
		expect(folders.getAttribute("aria-label")).not.toBe(
			sidebar.getAttribute("aria-label"),
		);
	});

	it("gives the skip link a main it can move the focus to, though this main does not scroll", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		const main = screen.getByRole("main");
		expect(main).toHaveAttribute("tabindex", "-1");
		main.focus();
		expect(document.activeElement).toBe(main);
	});

	it("says under the brand that this is the mail, and the brand leads to its home", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		const home = screen.getByRole("link", { name: /Epistle/ });
		expect(home).toHaveAttribute("href", "/app/mail");
		expect(home).toHaveTextContent("heading");
	});

	it("puts the way into the composer and the folders in the sidebar", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);
		await renderLayout();

		const sidebar = screen.getByRole("complementary");
		expect(sidebar).toContainElement(
			screen.getByRole("link", { name: "compose" }),
		);
		const folders = await screen.findByRole("navigation", {
			name: "folders",
		});
		expect(sidebar).toContainElement(folders);
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("href", "/app/mail/inbox");
	});

	it("says the storage, the version and the copyright notice at the foot of the sidebar, in that order", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);
		await renderLayout();

		const foot = document.querySelector(
			"[data-slot='sidebar-footer']",
		) as HTMLElement;
		const parts = [
			foot.querySelector("[data-slot='quota']"),
			foot.querySelector("[data-slot='panel-version']"),
			foot.querySelector("[data-slot='copyright-notice']"),
		] as HTMLElement[];
		for (const part of parts) {
			expect(part).not.toBeNull();
		}
		expect(screen.getByRole("meter", { name: "storage" })).toHaveAttribute(
			"value",
			"25",
		);
		for (const [index, part] of parts.entries()) {
			const next = parts[index + 1];
			if (next !== undefined) {
				expect(
					part.compareDocumentPosition(next) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				).not.toBe(0);
			}
		}
	});

	it("draws no storage for a session with no mail of its own, and keeps the rest of the foot", async () => {
		await cookies.signIn("ana", "user");
		const seen = stubJmap(answers);
		await renderLayout();

		const foot = document.querySelector("[data-slot='sidebar-footer']");
		expect(foot?.querySelector("[data-slot='quota']")).toBeNull();
		expect(
			foot?.querySelector("[data-slot='panel-version']"),
		).not.toBeNull();
		expect(seen.flatMap((request) => request.calls)).toEqual([]);
	});

	it("holds the storage's place with a block of its own height until the mail server answers, so the foot does not move", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);
		const first = render(withQuery(await resolveFirstPaint(await shell())));
		const held = first.container.querySelector(
			"[data-slot='quota-placeholder']",
		);
		expect(held).not.toBeNull();
		// 76 px: the padding, the title, the bar and the figures of the box.
		expect(held).toHaveClass("min-h-19", "rounded-xl");
		expect(held).toHaveAttribute("aria-hidden", "true");
		expect(first.container.querySelector("[data-slot='quota']")).toBeNull();
		cleanup();

		const { container } = await renderLayout();
		expect(
			container.querySelector("[data-slot='quota-placeholder']"),
		).toBeNull();
		expect(container.querySelector("[data-slot='quota']")).toHaveClass(
			"min-h-19",
			"rounded-xl",
		);
	});

	it("fills the place it held with a box of the same height whatever the mail server answers: no limit, no quota, or nothing", async () => {
		await cookies.signIn("ops", "admin");
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			for (const [name, quota] of [
				[
					"no limit",
					{
						list: [
							{ resourceType: "octets", used: 5, limit: null },
						],
					},
				],
				["no quota", { list: [] }],
				["no answer", undefined],
			] as const) {
				stubJmap(
					quota === undefined
						? { "Mailbox/get": answers["Mailbox/get"] }
						: { ...answers, "Quota/get": quota },
				);
				const first = render(
					withQuery(await resolveFirstPaint(await shell())),
				);
				expect([
					name,
					first.container.querySelector(
						"[data-slot='quota-placeholder']",
					) !== null,
				]).toEqual([name, true]);
				cleanup();

				const { container } = await renderLayout();
				const box = container.querySelector("[data-slot='quota']");
				expect([name, box !== null]).toEqual([name, true]);
				expect(box).toHaveClass("min-h-19", "rounded-xl");
				expect(
					container.querySelector("[data-slot='quota-placeholder']"),
				).toBeNull();
				await settled();
				cleanup();
			}
		} finally {
			logged.mockRestore();
		}
	});

	it("holds no place for the storage of a session with no mail of its own", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);

		const { container } = render(
			withQuery(await resolveFirstPaint(await shell())),
		);

		expect(
			container.querySelector("[data-slot='quota-placeholder']"),
		).toBeNull();
	});

	it("sends the frame before the mail server is asked: a skeleton for the folders, and the storage's place held", async () => {
		await cookies.signIn("ops", "admin");
		const seen = stubJmap(answers);
		const { container } = render(
			withQuery(await resolveFirstPaint(await shell())),
		);

		expect(seen).toHaveLength(0);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "compose" }),
		).toBeInTheDocument();
		expect(
			screen
				.getByRole("complementary")
				.querySelector('[aria-busy="true"]'),
		).not.toBeNull();
		expect(container.querySelector("[data-slot='quota']")).toBeNull();
		expect(
			container.querySelector("[data-slot='panel-version']"),
		).not.toBeNull();
	});

	it("starts with the sidebar collapsed only when the saved state says so", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		cookies.jar.set("sidebar_state", "false");
		const first = await renderLayout();
		expect(
			first.container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "collapsed");
		cleanup();

		for (const value of ["true", "garbage", ""]) {
			cookies.jar.set("sidebar_state", value);
			const next = await renderLayout();
			expect([
				value,
				next.container
					.querySelector("[data-slot='sidebar']")
					?.getAttribute("data-state"),
			]).toEqual([value, "expanded"]);
			cleanup();
		}
		cookies.jar.delete("sidebar_state");
		const none = await renderLayout();
		expect(
			none.container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "expanded");
	});

	it("sends the folders closed, placeholder first and tree after, only when the groups' cookie names the folders", async () => {
		await cookies.signIn("ana", "admin");
		stubJmap(answers);
		/** The frame as it is first sent, then with what it streams. */
		const states = async () => {
			const first = render(
				withQuery(await resolveFirstPaint(await shell())),
			);
			const placeholder = first.container
				.querySelector("[data-slot='folder-skeleton']")
				?.getAttribute("data-state");
			cleanup();
			const whole = await renderLayout();
			const heading = whole.container
				.querySelector("[data-slot='sidebar-group-label']")
				?.getAttribute("aria-expanded");
			const markup = whole.container.innerHTML;
			cleanup();
			return { placeholder, heading, markup };
		};

		for (const value of ["folders", "manage.folders"]) {
			cookies.jar.set("sidebar_groups", value);
			const { placeholder, heading } = await states();
			expect([value, placeholder, heading]).toEqual([
				value,
				"closed",
				"false",
			]);
		}
		for (const value of [
			"manage",
			"",
			"Folders",
			"folders.other",
			'folders"><i data-from-cookie="1">',
		]) {
			cookies.jar.set("sidebar_groups", value);
			const { placeholder, heading, markup } = await states();
			expect([value, placeholder, heading]).toEqual([
				value,
				"open",
				"true",
			]);
			expect(markup).not.toContain("data-from-cookie");
		}
		cookies.jar.delete("sidebar_groups");
		expect((await states()).placeholder).toBe("open");
	});

	it("gives a session that is not an admin's no way into the administration, in the markup or in what the menu is handed", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);

		const html = renderToStaticMarkup(
			withQuery(await resolveServerTree(await shell())),
		);

		expect(html).not.toContain(TEST_ADMIN_ID);
		expect(html).not.toContain("administration");
	});

	it("offers an admin session the way into the administration, built on the server", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);

		const html = renderToStaticMarkup(
			withQuery(await resolveServerTree(await shell())),
		);

		// In the markup itself, where it works without script.
		expect(html).toContain(`href="/app/${TEST_ADMIN_ID}"`);
	});

	it("serves the whole frame with no style attribute", async () => {
		await cookies.signIn("ops", "admin");
		stubJmap(answers);

		const html = renderToStaticMarkup(
			withQuery(await resolveServerTree(await shell())),
		);

		expect(html).toContain('data-slot="quota"');
		expect(html).not.toContain("style=");
		expect(html).not.toContain("<style");
	});
});
