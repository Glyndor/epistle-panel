import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { AppShell } from "@/components/layout/app-shell";
import { navItems } from "@/features/navigation/config/items";
import { navForRole } from "@/features/navigation/queries/nav-for-role";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";
import {
	OTHER_ADMIN_ID,
	TEST_ADMIN_ID,
} from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();

const { default: AdminLayout } = await import("./layout");

beforeEach(() => {
	cookies.reset();
});
afterEach(cleanup);

const params = (adminId = TEST_ADMIN_ID) => Promise.resolve({ adminId });

/** The layout's element is an AppShell; run it too so its server parts render. */
async function layoutElement(adminId = TEST_ADMIN_ID) {
	const routes = (await AdminLayout({
		children: <p>page</p>,
		params: params(adminId),
	})) as React.ReactElement<{
		children: React.ReactElement<{
			children: React.ReactElement<React.ComponentProps<typeof AppShell>>;
		}>;
	}>;
	// The layout wraps the shell in the routes provider and the query provider.
	return routes.props.children.props.children;
}

async function renderLayout() {
	const element = await layoutElement();
	return render(withQuery(await resolveServerTree(AppShell(element.props))));
}

describe("AdminLayout", () => {
	it("answers 404, not a redirect, without a session, before rendering anything", async () => {
		const outcome = await layoutElement().catch((e) => e);

		expect(outcome).toBeInstanceOf(NotFoundSignal);
	});

	it("answers 404 to a session without the admin role", async () => {
		await cookies.signIn("ana", "user");

		expect(await layoutElement().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
	});

	it("answers 404 when the segment is not the configured id, an admin or not", async () => {
		await cookies.signIn("ops", "admin");

		for (const adminId of [
			OTHER_ADMIN_ID,
			TEST_ADMIN_ID.toUpperCase(),
			`${TEST_ADMIN_ID}0`,
			TEST_ADMIN_ID.slice(0, -1),
			"mail",
			"",
		]) {
			expect(
				await layoutElement(adminId).catch((e) => e),
				adminId,
			).toBeInstanceOf(NotFoundSignal);
		}
	});

	it("hands the shell the admin navigation, built from the id, and the account name", async () => {
		await cookies.signIn("ops");

		const { props } = await layoutElement();

		expect(props.groups).toEqual(
			navForRole("admin", navItems(adminRoutes(TEST_ADMIN_ID))),
		);
		expect(String(props.homeHref)).toBe(`/app/${TEST_ADMIN_ID}`);
		expect(props.user).toEqual({ name: "ops", role: "admin" });
		expect(String(props.adminHref)).toBe(`/app/${TEST_ADMIN_ID}`);
	});

	it("renders the skip link, sidebar, header and exactly one main landmark", async () => {
		await cookies.signIn("ops");
		await renderLayout();

		expect(screen.getAllByRole("main")).toHaveLength(1);
		const main = screen.getByRole("main");
		expect(main).toHaveAttribute("id", "main-content");
		expect(main).toContainElement(screen.getByText("page"));
		expect(screen.getByRole("link", { name: "skip" })).toHaveAttribute(
			"href",
			"#main-content",
		);
		expect(
			screen.getByRole("navigation", { name: "label" }),
		).toBeInTheDocument();
		expect(screen.getByRole("banner")).toBeInTheDocument();
	});

	it("starts collapsed only when the saved state says so", async () => {
		await cookies.signIn("ops");
		cookies.jar.set("sidebar_state", "false");
		const { container } = await renderLayout();

		expect(
			container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "collapsed");
		cleanup();

		cookies.jar.set("sidebar_state", "garbage");
		const second = await renderLayout();
		expect(
			second.container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "expanded");
	});
});
