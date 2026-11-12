import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();

const { default: AppLayout } = await import("./layout");

beforeEach(() => {
	cookies.reset();
});
afterEach(cleanup);

describe("AppLayout", () => {
	it("redirects to the login page without a session, before rendering anything", async () => {
		const outcome = await AppLayout({ children: <p>page</p> }).catch(
			(e) => e,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
	});

	it("renders the skip link, sidebar, header and exactly one main landmark", async () => {
		await cookies.signIn("ops");
		render(
			await resolveServerTree(await AppLayout({ children: <p>page</p> })),
		);

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
		const { container } = render(
			await resolveServerTree(await AppLayout({ children: <p>page</p> })),
		);

		expect(
			container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "collapsed");
		cleanup();

		cookies.jar.set("sidebar_state", "garbage");
		const second = render(
			await resolveServerTree(await AppLayout({ children: <p>page</p> })),
		);
		expect(
			second.container.querySelector("[data-slot='sidebar']"),
		).toHaveAttribute("data-state", "expanded");
	});
});
