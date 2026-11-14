import { afterEach, beforeEach, describe, expect, it } from "bun:test";
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

const slots = { children: <p>page</p> };

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
			screen.getByRole("complementary", { name: "foldersTitle" }),
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

	it("keeps the header's middle for the search", async () => {
		await cookies.signIn("ana", "user");
		stubJmap(answers);
		await renderLayout();

		const banner = screen.getByRole("banner");
		const cell = banner.querySelector("[data-slot='header-search']");
		expect(cell).not.toBeNull();
		// The search is not built yet: the cell is kept, and empty.
		expect(cell?.childElementCount).toBe(0);
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

	it("sends the frame before the mail server is asked: a skeleton for the folders, nothing yet for the storage", async () => {
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
