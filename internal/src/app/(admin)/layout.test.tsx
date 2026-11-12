import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/features/navigation/queries/nav-for-role";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();

const { default: AdminLayout } = await import("./layout");

beforeEach(() => {
	cookies.reset();
});
afterEach(cleanup);

/** The layout's element is an AppShell; run it too so its server parts render. */
async function layoutElement() {
	return (await AdminLayout({ children: <p>page</p> })) as React.ReactElement<
		React.ComponentProps<typeof AppShell>
	>;
}

async function renderLayout() {
	const element = await layoutElement();
	return render(await resolveServerTree(AppShell(element.props)));
}

describe("AdminLayout", () => {
	it("redirects to the login page without a session, before rendering anything", async () => {
		const outcome = await layoutElement().catch((e) => e);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
	});

	it("hands the shell the admin navigation and the account name", async () => {
		await cookies.signIn("ops");

		const { props } = await layoutElement();

		expect(props.groups).toEqual(navForRole("admin"));
		expect(props.userName).toBe("ops");
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
