import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "@/components/layout/app-shell";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: MeLayout } = await import("./layout");

beforeEach(() => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_PANEL_ADMIN_ID"] = TEST_ADMIN_ID;
});
afterEach(() => {
	process.env = { ...savedEnv };
	cleanup();
});

/** The layout's element is the query provider around an AppShell: run the shell too. */
async function shell() {
	const layout = (await MeLayout({
		children: <p>page</p>,
	})) as React.ReactElement<{
		children: React.ReactElement<React.ComponentProps<typeof AppShell>>;
	}>;
	return AppShell(layout.props.children.props);
}
async function renderLayout() {
	render(withQuery(await resolveServerTree(await shell())));
}

describe("MeLayout", () => {
	it("redirects to sign-in without a session, before rendering anything", async () => {
		const outcome = await MeLayout({ children: <p>page</p> }).catch(
			(e) => e,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
	});

	it("is the panel's shell: skip link first, a sidebar, a header and one main with the page", async () => {
		await cookies.signIn("ana", "user");
		await renderLayout();

		expect(screen.getAllByRole("main")).toHaveLength(1);
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("page"),
		);
		expect(document.querySelector("a, button, select")).toHaveAttribute(
			"href",
			"#main-content",
		);
		expect(
			screen.getByRole("complementary", { name: "sheetTitle" }),
		).toBeInTheDocument();
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "account" }),
		).toHaveTextContent("ana");
	});

	it("says under the brand what this is, and the brand leads back to the mail", async () => {
		await cookies.signIn("ana", "user");
		await renderLayout();

		const home = screen.getByRole("link", { name: /Epistle/ });
		expect(home).toHaveAttribute("href", "/app/mail");
		expect(home).toHaveTextContent("preferences");
	});

	it("draws the trail in the header and the navigation in the sidebar, the page being the current entry", async () => {
		await cookies.signIn("ana", "user");
		await renderLayout();

		expect(
			screen.getByRole("banner").querySelector('[aria-current="page"]'),
		).toHaveTextContent("preferences");
		const sidebar = screen.getByRole("complementary");
		expect(sidebar.querySelector('a[aria-current="page"]')).toHaveAttribute(
			"href",
			"/app/me",
		);
	});

	it("gives a user session no way into the administration, and an admin session its own address", async () => {
		await cookies.signIn("ana", "user");
		await renderLayout();
		expect(
			screen.queryByRole("link", { name: "administration" }),
		).toBeNull();
		cleanup();
		cookies.reset();

		await cookies.signIn("ops", "admin");
		await renderLayout();
		expect(
			screen.getByRole("link", { name: "administration" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}`);
	});

	it("does not invent the way in from the role alone, when the installation has no admin area", async () => {
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		clearSecretCache();
		await cookies.signIn("ops", "admin");
		await renderLayout();

		expect(
			screen.queryByRole("link", { name: "administration" }),
		).toBeNull();
	});

	it("serves no inline style", async () => {
		await cookies.signIn("ana", "user");
		const html = renderToStaticMarkup(
			withQuery(await resolveServerTree(await shell())),
		);

		expect(html).not.toMatch(/ style=|<style/);
	});
});
