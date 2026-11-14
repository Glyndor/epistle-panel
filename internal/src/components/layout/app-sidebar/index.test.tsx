import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { COPYRIGHT_NOTICE } from "@/features/branding/copyright";
import {
	BRAND_LOGO_VARIABLE,
	BRAND_NAME_VARIABLE,
} from "@/features/branding/queries/brand";
import { TEST_ROUTES } from "@/features/navigation/test-support/admin-nav";
import { resetIntl, saidWith } from "@/test/next-intl";

const { AppSidebar } = await import(".");

afterEach(() => {
	cleanup();
	resetIntl();
	delete process.env[BRAND_NAME_VARIABLE];
	delete process.env[BRAND_LOGO_VARIABLE];
});

type SidebarProps = Parameters<typeof AppSidebar>[0];

async function renderSidebar(
	props: Partial<SidebarProps> = {},
	defaultOpen = true,
) {
	return render(
		<SidebarProvider defaultOpen={defaultOpen}>
			{
				await AppSidebar({
					homeHref: TEST_ROUTES.home,
					subtitle: "Admin panel",
					sheet: { title: "Navigation", description: "Pages." },
					children: (
						<nav aria-label="pages">
							<a href="/somewhere">somewhere</a>
						</nav>
					),
					...props,
				})
			}
		</SidebarProvider>,
	);
}

describe("AppSidebar", () => {
	it("holds the brand and the navigation it is given; the account is in the header's profile menu", async () => {
		await renderSidebar();

		expect(screen.getByRole("link", { name: /Epistle/ })).toHaveAttribute(
			"href",
			TEST_ROUTES.home,
		);
		expect(
			screen.getByRole("navigation", { name: "pages" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "logout" })).toBeNull();
		expect(screen.queryByRole("button", { name: "language" })).toBeNull();
	});

	it("says under the brand what the area is, and names the landmark as the area asks", async () => {
		await renderSidebar({
			subtitle: "Mail",
			sheet: { title: "Folders", description: "Your folders." },
		});

		expect(screen.getByRole("link", { name: /Epistle/ })).toHaveTextContent(
			"Mail",
		);
		expect(
			screen.getByRole("complementary", { name: "Folders" }),
		).toBeInTheDocument();
	});

	it("draws the brand mark as a decorative SVG", async () => {
		const { container } = await renderSidebar();

		expect(
			container.querySelector(
				`a[href='${TEST_ROUTES.home}'] svg[aria-hidden='true']`,
			),
		).not.toBeNull();
	});

	it("shows the operator's name and logo, and keeps the original copyright notice", async () => {
		process.env[BRAND_NAME_VARIABLE] = "Acme Mail";
		process.env[BRAND_LOGO_VARIABLE] = "/run/logo.svg";
		const { container } = await renderSidebar();

		expect(
			screen.getByRole("link", { name: /Acme Mail/ }),
		).toBeInTheDocument();
		expect(
			container.querySelector(`a[href='${TEST_ROUTES.home}'] img`),
		).toHaveAttribute("src", "/brand/logo");
		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});

	it("keeps the copyright notice with the default branding too", async () => {
		await renderSidebar();

		expect(screen.getByText(COPYRIGHT_NOTICE)).toBeInTheDocument();
	});

	it("says at its foot the version the panel's own manifest states", async () => {
		await renderSidebar();

		const manifest = JSON.parse(
			readFileSync(
				join(import.meta.dir, "..", "..", "..", "..", "package.json"),
				"utf8",
			),
		) as { version: string };
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(saidWith("version")).toEqual([{ version: manifest.version }]);
		const foot = document.querySelector("[data-slot='sidebar-footer']");
		expect(foot).toContainElement(
			document.querySelector<HTMLElement>("[data-slot='panel-version']"),
		);
		expect(foot).toContainElement(screen.getByText(COPYRIGHT_NOTICE));
	});

	it("puts what the area adds to the foot first, then the version, then the notice", async () => {
		await renderSidebar({ footer: <p>storage</p> });

		const foot = document.querySelector(
			"[data-slot='sidebar-footer']",
		) as HTMLElement;
		expect(foot.textContent).toBe(`storageversion${COPYRIGHT_NOTICE}`);
	});

	it("keeps the foot's words for a screen reader while collapsed to icons, and does not draw them", async () => {
		await renderSidebar({}, false);

		const words = document.querySelector(
			"[data-slot='panel-version']",
		)?.parentElement;
		expect(words).toHaveClass("group-data-[collapsible=icon]:sr-only");
		expect(words).toContainElement(screen.getByText(COPYRIGHT_NOTICE));
	});

	it("keeps the navigation in the part that scrolls and the foot out of it", async () => {
		await renderSidebar();

		const content = document.querySelector("[data-slot='sidebar-content']");
		expect(content).toHaveClass("min-h-0", "flex-1", "overflow-auto");
		expect(content).toContainElement(
			screen.getByRole("navigation", { name: "pages" }),
		);
		expect(content).not.toContainElement(
			document.querySelector<HTMLElement>("[data-slot='sidebar-footer']"),
		);
	});

	it("writes the copyright notice at the size of the version above it, not at a small's share of it", async () => {
		await renderSidebar();

		// A `small` is 80% of its parent, which is already 12 px: it measured
		// 9.6 px until it named its own size.
		expect(screen.getByText(COPYRIGHT_NOTICE)).toHaveClass("text-xs");
		expect(screen.getByText(COPYRIGHT_NOTICE).tagName).toBe("SMALL");
	});
});
