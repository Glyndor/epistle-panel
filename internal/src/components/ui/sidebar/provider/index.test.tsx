import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NavSection } from "@/components/layout/nav-section";
import { captureCookieWrites } from "@/test/cookie-capture";
import { useSidebar } from "../context";
import { SidebarTrigger } from "../trigger";
import { SidebarProvider } from ".";

function Probe() {
	const { state, toggleSidebar } = useSidebar();
	return (
		<button type="button" onClick={toggleSidebar}>
			{state}
		</button>
	);
}

function MobileProbe() {
	const { isMobile, openMobile, toggleSidebar } = useSidebar();
	return (
		<button type="button" onClick={toggleSidebar}>
			{`${isMobile}-${openMobile}`}
		</button>
	);
}

let capture: ReturnType<typeof captureCookieWrites> | undefined;

afterEach(() => {
	cleanup();
	capture?.restore();
	capture = undefined;
	window.innerWidth = 1024;
});

describe("SidebarProvider", () => {
	it("starts expanded or collapsed as told, then toggles and remembers the choice", () => {
		capture = captureCookieWrites();
		const { writes } = capture;
		render(
			<SidebarProvider defaultOpen={false}>
				<Probe />
			</SidebarProvider>,
		);
		expect(screen.getByRole("button")).toHaveTextContent("collapsed");

		fireEvent.click(screen.getByRole("button"));

		expect(screen.getByRole("button")).toHaveTextContent("expanded");
		// The whole panel: the choice made in one area holds in the other.
		expect(writes.at(-1)).toStartWith(
			"sidebar_state=true; path=/; max-age=",
		);
		expect(writes.at(-1)).toContain("SameSite=Lax");
	});

	it("hands the focus to the toggle when the rail collapses under a group's heading, which is then not drawn", () => {
		render(
			<SidebarProvider>
				<NavSection label="Manage">
					<a href="/domains">Domains</a>
				</NavSection>
				<SidebarTrigger label="Toggle sidebar" />
			</SidebarProvider>,
		);
		const heading = screen.getByRole("button", { name: "Manage" });
		const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
		heading.focus();
		expect(document.activeElement).toBe(heading);

		fireEvent.keyDown(window, { key: "b", ctrlKey: true });

		expect(document.activeElement).toBe(toggle);
		// Expanding again moves nothing: the heading is back and the focus
		// stays where the person is.
		fireEvent.keyDown(window, { key: "b", ctrlKey: true });
		expect(document.activeElement).toBe(toggle);
	});

	it("leaves the focus alone when the rail collapses under anything that stays drawn", () => {
		render(
			<SidebarProvider>
				<NavSection label="Manage">
					<a href="/domains">Domains</a>
				</NavSection>
				<SidebarTrigger label="Toggle sidebar" />
			</SidebarProvider>,
		);
		const entry = screen.getByRole("link", { name: "Domains" });
		entry.focus();

		fireEvent.keyDown(window, { key: "b", ctrlKey: true });

		expect(document.activeElement).toBe(entry);
	});

	it("toggles with Ctrl+B and ignores the plain letter", () => {
		render(
			<SidebarProvider>
				<Probe />
			</SidebarProvider>,
		);

		fireEvent.keyDown(window, { key: "b" });
		expect(screen.getByRole("button")).toHaveTextContent("expanded");

		fireEvent.keyDown(window, { key: "b", ctrlKey: true });
		expect(screen.getByRole("button")).toHaveTextContent("collapsed");
	});

	it("sets the width variables with classes, never a style attribute", () => {
		const { container } = render(
			<SidebarProvider>
				<Probe />
			</SidebarProvider>,
		);

		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper).not.toHaveAttribute("style");
		expect(wrapper.className).toContain("[--sidebar-width:14rem]");
		expect(wrapper.className).toContain("[--sidebar-width-icon:3rem]");
		expect(wrapper.className).toContain(
			"pointer-coarse:[--sidebar-width-icon:4rem]",
		);
	});

	it("opens the mobile sheet instead of the rail on a narrow viewport", () => {
		window.innerWidth = 400;
		capture = captureCookieWrites();
		const { writes } = capture;
		render(
			<SidebarProvider>
				<MobileProbe />
			</SidebarProvider>,
		);
		expect(screen.getByRole("button")).toHaveTextContent("true-false");

		fireEvent.click(screen.getByRole("button"));

		expect(screen.getByRole("button")).toHaveTextContent("true-true");
		expect(writes).toEqual([]);
	});
});
