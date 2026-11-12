import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { navForRole } from "@/features/navigation/queries/nav-for-role";
import { resolveServerTree } from "@/test/server-tree";

import { AppShell } from ".";

afterEach(cleanup);

async function renderShell(defaultOpen = true) {
	render(
		await resolveServerTree(
			AppShell({
				groups: navForRole("admin"),
				userName: "ops",
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
					userName: "u",
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
});
