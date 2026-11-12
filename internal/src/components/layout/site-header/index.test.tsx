import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { BRAND_NAME_VARIABLE } from "@/features/branding/queries/brand";

const { SiteHeader } = await import(".");

afterEach(() => {
	cleanup();
	delete process.env[BRAND_NAME_VARIABLE];
});

describe("SiteHeader", () => {
	it("has the sidebar toggle and the product name, and no heading of its own", async () => {
		render(<SidebarProvider>{await SiteHeader()}</SidebarProvider>);

		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "toggle" }),
		).toBeInTheDocument();
		expect(screen.getByText("Epistle")).toBeInTheDocument();
		expect(screen.queryByRole("heading")).toBeNull();
	});

	it("shows the operator's product name", async () => {
		process.env[BRAND_NAME_VARIABLE] = "Acme Mail";
		render(<SidebarProvider>{await SiteHeader()}</SidebarProvider>);

		expect(screen.getByText("Acme Mail")).toBeInTheDocument();
	});

	it("keeps the product name visible only where the sidebar is a sheet", async () => {
		render(<SidebarProvider>{await SiteHeader()}</SidebarProvider>);

		expect(screen.getByText("Epistle")).toHaveClass("md:sr-only");
	});
});
