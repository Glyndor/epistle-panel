import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { navForRole } from "@/features/navigation/queries/nav-for-role";

const { AppSidebar } = await import(".");

afterEach(cleanup);

describe("AppSidebar", () => {
	it("holds the brand, the four pages and the signed-in user", async () => {
		render(
			<SidebarProvider>
				{
					await AppSidebar({
						name: "admin",
						groups: navForRole("admin"),
					})
				}
			</SidebarProvider>,
		);

		expect(screen.getByRole("link", { name: /brand/ })).toHaveAttribute(
			"href",
			"/",
		);
		const nav = screen.getByRole("navigation", { name: "label" });
		expect(nav.querySelectorAll("a")).toHaveLength(4);
		expect(
			screen.getByRole("button", { name: "logout" }),
		).toBeInTheDocument();
		expect(screen.getByText("signedInAs")).toBeInTheDocument();
	});

	it("draws the brand mark as a decorative SVG", async () => {
		const { container } = render(
			<SidebarProvider>
				{
					await AppSidebar({
						name: "admin",
						groups: navForRole("admin"),
					})
				}
			</SidebarProvider>,
		);

		expect(
			container.querySelector("a[href='/'] svg[aria-hidden='true']"),
		).not.toBeNull();
	});
});
