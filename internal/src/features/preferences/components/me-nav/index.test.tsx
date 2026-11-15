import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import type { Route } from "next";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { resolveServerTree } from "@/test/server-tree";

import { MeNav } from ".";

afterEach(cleanup);

async function renderNav(adminHref?: string) {
	const tree = await resolveServerTree(
		<SidebarProvider defaultOpen>
			<MeNav adminHref={adminHref as Route | undefined} />
		</SidebarProvider>,
	);
	render(tree);
}

const links = () =>
	screen
		.getAllByRole("link")
		.map((link) => [link.textContent, link.getAttribute("href")]);

describe("MeNav", () => {
	it("leads back to the mail and marks the preferences page as the current one", async () => {
		await renderNav();

		expect(links()).toEqual([
			["mail", "/app/mail"],
			["preferences", "/app/me"],
		]);
		const current = screen.getByRole("link", { name: "preferences" });
		expect(current).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "mail" })).not.toHaveAttribute(
			"aria-current",
		);
		// The fill the sidebar gives the current entry, not only the mark for a reader.
		expect(current).toHaveAttribute("data-active", "true");
		expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute(
			"data-active",
			"false",
		);
	});

	it("adds the way into the administration, between the two, only when the server gave an address", async () => {
		await renderNav("/app/abc");

		expect(links()).toEqual([
			["mail", "/app/mail"],
			["administration", "/app/abc"],
			["preferences", "/app/me"],
		]);
	});
});
