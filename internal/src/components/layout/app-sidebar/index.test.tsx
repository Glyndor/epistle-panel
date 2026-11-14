import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";
import {
	BRAND_LOGO_VARIABLE,
	BRAND_NAME_VARIABLE,
} from "@/features/branding/queries/brand";
import {
	adminNav,
	TEST_ROUTES,
} from "@/features/navigation/test-support/admin-nav";

const { AppSidebar } = await import(".");

afterEach(() => {
	cleanup();
	delete process.env[BRAND_NAME_VARIABLE];
	delete process.env[BRAND_LOGO_VARIABLE];
});

describe("AppSidebar", () => {
	it("holds the brand and the pages; the account is in the header's profile menu", async () => {
		render(
			<SidebarProvider>
				{
					await AppSidebar({
						groups: adminNav(),
						homeHref: TEST_ROUTES.home,
					})
				}
			</SidebarProvider>,
		);

		expect(screen.getByRole("link", { name: /Epistle/ })).toHaveAttribute(
			"href",
			TEST_ROUTES.home,
		);
		const nav = screen.getByRole("navigation", { name: "label" });
		expect(nav.querySelectorAll("a")).toHaveLength(6);
		expect(screen.queryByRole("button", { name: "logout" })).toBeNull();
		expect(screen.queryByRole("button", { name: "language" })).toBeNull();
	});

	it("draws the brand mark as a decorative SVG", async () => {
		const { container } = render(
			<SidebarProvider>
				{
					await AppSidebar({
						groups: adminNav(),
						homeHref: TEST_ROUTES.home,
					})
				}
			</SidebarProvider>,
		);

		expect(
			container.querySelector(
				`a[href='${TEST_ROUTES.home}'] svg[aria-hidden='true']`,
			),
		).not.toBeNull();
	});

	it("shows the operator's name and logo, and keeps the original copyright notice", async () => {
		process.env[BRAND_NAME_VARIABLE] = "Acme Mail";
		process.env[BRAND_LOGO_VARIABLE] = "/run/logo.svg";
		const { container } = render(
			<SidebarProvider>
				{
					await AppSidebar({
						groups: adminNav(),
						homeHref: TEST_ROUTES.home,
					})
				}
			</SidebarProvider>,
		);

		expect(
			screen.getByRole("link", { name: /Acme Mail/ }),
		).toBeInTheDocument();
		expect(
			container.querySelector(`a[href='${TEST_ROUTES.home}'] img`),
		).toHaveAttribute("src", "/brand/logo");
		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});

	it("keeps the copyright notice with the default branding too", async () => {
		render(
			<SidebarProvider>
				{
					await AppSidebar({
						groups: adminNav(),
						homeHref: TEST_ROUTES.home,
					})
				}
			</SidebarProvider>,
		);

		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});
});
