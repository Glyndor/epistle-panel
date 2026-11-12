import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { intlServerMock } from "@/test/intl-server";

mock.module("next-intl/server", () => intlServerMock);

const { SiteHeader } = await import(".");

afterEach(cleanup);

describe("SiteHeader", () => {
	it("has the sidebar toggle and the product name, and no heading of its own", async () => {
		render(<SidebarProvider>{await SiteHeader()}</SidebarProvider>);

		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "toggle" }),
		).toBeInTheDocument();
		expect(screen.getByText("brand")).toBeInTheDocument();
		expect(screen.queryByRole("heading")).toBeNull();
	});

	it("keeps the product name visible only where the sidebar is a sheet", async () => {
		render(<SidebarProvider>{await SiteHeader()}</SidebarProvider>);

		expect(screen.getByText("brand")).toHaveClass("md:sr-only");
	});
});
