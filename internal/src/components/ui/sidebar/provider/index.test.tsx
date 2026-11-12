import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useSidebar } from "../context";
import { SIDEBAR_COOKIE, SidebarProvider } from ".";

function Probe() {
	const { state, toggleSidebar } = useSidebar();
	return (
		<button type="button" onClick={toggleSidebar}>
			{state}
		</button>
	);
}

/** Capture what the provider writes to `document.cookie`; happy-dom keeps none without a URL. */
function captureCookies() {
	const writes: string[] = [];
	Object.defineProperty(document, "cookie", {
		configurable: true,
		get: () => writes.join("; "),
		set: (value: string) => {
			writes.push(value);
		},
	});
	return writes;
}
function MobileProbe() {
	const { isMobile, openMobile, toggleSidebar } = useSidebar();
	return (
		<button type="button" onClick={toggleSidebar}>
			{`${isMobile}-${openMobile}`}
		</button>
	);
}

afterEach(() => {
	cleanup();
	delete (document as { cookie?: string }).cookie;
	window.innerWidth = 1024;
});

describe("SidebarProvider", () => {
	it("starts expanded or collapsed as told, then toggles and remembers the choice", () => {
		const writes = captureCookies();
		render(
			<SidebarProvider defaultOpen={false}>
				<Probe />
			</SidebarProvider>,
		);
		expect(screen.getByRole("button")).toHaveTextContent("collapsed");

		fireEvent.click(screen.getByRole("button"));

		expect(screen.getByRole("button")).toHaveTextContent("expanded");
		expect(writes.at(-1)).toStartWith(
			`${SIDEBAR_COOKIE}=true; path=/; max-age=`,
		);
		expect(writes.at(-1)).toContain("SameSite=Lax");
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
		const writes = captureCookies();
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
