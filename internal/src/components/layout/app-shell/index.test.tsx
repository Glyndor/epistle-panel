import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	adminNav,
	TEST_ROUTES,
} from "@/features/navigation/test-support/admin-nav";
import { resolveServerTree } from "@/test/server-tree";

import { AppShell } from ".";

afterEach(cleanup);

async function renderShell(defaultOpen = true) {
	render(
		await resolveServerTree(
			AppShell({
				groups: adminNav(),
				homeHref: TEST_ROUTES.home,
				user: { name: "ops", role: "admin" },
				adminHref: TEST_ROUTES.home,
				defaultOpen,
				children: <p>page</p>,
			}),
		),
	);
}

describe("AppShell", () => {
	it("has the skip link first, one main landmark that holds the page, and the sidebar", async () => {
		await renderShell();

		expect(screen.getAllByRole("main")).toHaveLength(1);
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("page"),
		);
		expect(screen.getByRole("link", { name: "skip" })).toHaveAttribute(
			"href",
			"#main-content",
		);
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		expect(screen.getByRole("banner")).toBeInTheDocument();
	});

	it("draws the navigation it is given and nothing else", async () => {
		render(
			await resolveServerTree(
				AppShell({
					groups: [],
					homeHref: TEST_ROUTES.home,
					user: { name: "u", role: "admin" },
					defaultOpen: true,
					children: <p>page</p>,
				}),
			),
		);

		expect(screen.queryByRole("link", { name: "domains" })).toBeNull();
	});

	it("starts collapsed or expanded as told", async () => {
		await renderShell(false);

		expect(document.querySelector("[data-slot='sidebar']")).toHaveAttribute(
			"data-state",
			"collapsed",
		);
	});

	it("puts the profile menu of the account in the header, not in the sidebar", async () => {
		await renderShell();

		const account = screen.getByRole("button", { name: "account" });
		expect(screen.getByRole("banner")).toContainElement(account);
		expect(screen.getByRole("complementary")).not.toContainElement(account);
		expect(account).toHaveTextContent("ops");
	});
});
