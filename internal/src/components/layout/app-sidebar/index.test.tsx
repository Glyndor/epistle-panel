import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";
import {
	BRAND_LOGO_VARIABLE,
	BRAND_NAME_VARIABLE,
} from "@/features/branding/queries/brand";
import { navForRole } from "@/features/navigation/queries/nav-for-role";

const { AppSidebar } = await import(".");

afterEach(() => {
	cleanup();
	delete process.env[BRAND_NAME_VARIABLE];
	delete process.env[BRAND_LOGO_VARIABLE];
});

describe("AppSidebar", () => {
	it("holds the brand, the pages and the signed-in user", async () => {
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

		expect(screen.getByRole("link", { name: /Epistle/ })).toHaveAttribute(
			"href",
			"/",
		);
		const nav = screen.getByRole("navigation", { name: "label" });
		expect(nav.querySelectorAll("a")).toHaveLength(6);
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

	it("shows the operator's name and logo, and keeps the original copyright notice", async () => {
		process.env[BRAND_NAME_VARIABLE] = "Acme Mail";
		process.env[BRAND_LOGO_VARIABLE] = "/run/logo.svg";
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
			screen.getByRole("link", { name: /Acme Mail/ }),
		).toBeInTheDocument();
		expect(container.querySelector("a[href='/'] img")).toHaveAttribute(
			"src",
			"/brand/logo",
		);
		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});

	it("keeps the copyright notice with the default branding too", async () => {
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

		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});
});
