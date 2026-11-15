import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FORCED_POINTER } from "@/lib/pointer-states";
import { SidebarProvider } from "../provider";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from ".";

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function renderMenu(defaultOpen = true) {
	return render(
		<SidebarProvider defaultOpen={defaultOpen}>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton tooltip="Domains" isActive>
						<svg aria-hidden="true" />
						<span>Domains</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarProvider>,
	);
}

describe("SidebarMenuButton", () => {
	it("is 32px on a fine pointer and 44px on a coarse one", () => {
		renderMenu();

		expect(screen.getByRole("button", { name: "Domains" })).toHaveClass(
			"min-h-8",
			"pointer-coarse:min-h-11",
			"group-data-[collapsible=icon]:pointer-coarse:size-11",
		);
	});

	it("marks the active entry with data-active", () => {
		renderMenu();

		expect(screen.getByRole("button", { name: "Domains" })).toHaveAttribute(
			"data-active",
			"true",
		);
	});

	it("shows its tooltip beside the control on hover while the sidebar is collapsed", () => {
		renderMenu(false);

		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));

		const tip = document.querySelector("[data-slot='sidebar-tooltip']");
		expect(tip).toHaveTextContent("Domains");
		expect(tip).toHaveAttribute("aria-hidden", "true");
		expect(tip).toHaveClass("fixed");
	});

	it("shows no tooltip while the sidebar is expanded, on touch, or in the mobile sheet", () => {
		renderMenu(true);
		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
		cleanup();

		renderMenu(false);
		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "Domains" }),
			{
				pointerType: "touch",
			},
		);
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
		cleanup();

		window.innerWidth = 400;
		renderMenu(false);
		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("dismisses the tooltip with Escape", () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		fireEvent.pointerEnter(button);

		fireEvent.keyDown(button, { key: "Escape" });

		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("keeps the tooltip while the pointer moves onto it, and removes it after it leaves", async () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		fireEvent.pointerEnter(button);
		fireEvent.pointerLeave(button);
		const tip = document.querySelector(
			"[data-slot='sidebar-tooltip']",
		) as HTMLElement;

		fireEvent.pointerEnter(tip);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).not.toBeNull();

		fireEvent.pointerLeave(tip);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("runs the caller's own handlers too", () => {
		let entered = 0;
		render(
			<SidebarProvider defaultOpen={false}>
				<SidebarMenuButton tooltip="X" onPointerEnter={() => entered++}>
					X
				</SidebarMenuButton>
			</SidebarProvider>,
		);

		fireEvent.pointerEnter(screen.getByRole("button", { name: "X" }));

		expect(entered).toBe(1);
	});

	it("shows the tooltip on keyboard focus, not on a focus the pointer gave, and hides it on blur", async () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		const original = button.matches.bind(button);
		const tip = () =>
			document.querySelector("[data-slot='sidebar-tooltip']");

		// A focus that is not a keyboard one: no tooltip.
		button.matches = ((selector: string) =>
			selector === ":focus-visible"
				? false
				: original(selector)) as typeof button.matches;
		fireEvent.focus(button);
		expect(tip()).toBeNull();

		// A keyboard focus: the tooltip names the control.
		button.matches = ((selector: string) =>
			selector === ":focus-visible"
				? true
				: original(selector)) as typeof button.matches;
		fireEvent.keyDown(document.body, { key: "Tab" });
		fireEvent.focus(button);
		expect(tip()).toHaveTextContent("Domains");

		fireEvent.blur(button);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).toBeNull();
	});

	it("runs the caller's focus and blur handlers too", () => {
		const seen: string[] = [];
		render(
			<SidebarProvider defaultOpen={false}>
				<SidebarMenuButton
					tooltip="X"
					onFocus={() => seen.push("focus")}
					onBlur={() => seen.push("blur")}
				>
					X
				</SidebarMenuButton>
			</SidebarProvider>,
		);
		const button = screen.getByRole("button", { name: "X" });

		fireEvent.focus(button);
		fireEvent.blur(button);

		expect(seen).toEqual(["focus", "blur"]);
	});

	it("renders without a tooltip when none is given", () => {
		render(
			<SidebarProvider>
				<SidebarMenuButton>Plain</SidebarMenuButton>
			</SidebarProvider>,
		);

		expect(
			screen.getByRole("button", { name: "Plain" }),
		).toBeInTheDocument();
	});

	it("answers the pointer on the current entry too, with a fill of its own and its name underlined", () => {
		renderMenu();

		// The current entry is still a link: with a message open it is the
		// way back to the list. Its own fill hid the hover and the press of
		// every other entry, so it has both of its own.
		const current = screen.getByRole("button", { name: "Domains" });
		expect(current).toHaveClass(
			"data-[active=true]:bg-sidebar-accent",
			"data-[active=true]:hover:bg-sidebar-accent-hover",
			"data-[active=true]:hover:[&>span:first-of-type]:underline",
			"data-[active=true]:active:bg-sidebar-accent-press",
		);
		// And the entries that are not current keep theirs.
		expect(current).toHaveClass(
			"hover:bg-sidebar-accent/60",
			"active:bg-sidebar-accent-press",
		);
	});

	it("outlines an entry under the pointer, and thicker while pressed, when colours are forced", () => {
		renderMenu();

		expect(screen.getByRole("button", { name: "Domains" })).toHaveClass(
			...FORCED_POINTER.split(" "),
		);
	});

	it("marks the current entry on the rail by more than its fill: a bar on its starting edge", () => {
		renderMenu(false);

		const current = screen.getByRole("button", { name: "Domains" });
		expect(current).toHaveClass(
			"relative",
			"before:absolute",
			"before:inset-y-2",
			"before:start-0",
			"before:w-1",
			"before:bg-sidebar-foreground",
			// Not drawn unless the rail is collapsed and the entry current.
			"before:hidden",
			"group-data-[collapsible=icon]:data-[active=true]:before:block",
		);
	});
	it("draws a focus ring that fits in the room between two entries, on a link as on a button", () => {
		const { container } = render(
			<SidebarProvider>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<a href="/domains">Domains</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton isActive>Accounts</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarProvider>,
		);
		/** The number a class of the element ends with, of the ones that start with `prefix`. */
		const number = (element: Element | null, prefix: string) => {
			const found = Array.from(element?.classList ?? []).filter(
				(name) =>
					name.startsWith(prefix) &&
					/^[\d.]+$/.test(name.slice(prefix.length)),
			);
			return found.length === 1
				? Number((found[0] ?? "").slice(prefix.length))
				: Number.NaN;
		};
		// A unit of the spacing scale is 4 px.
		const room =
			number(
				container.querySelector("[data-slot='sidebar-menu']"),
				"gap-",
			) * 4;
		expect(room).toBe(2);

		for (const entry of [
			screen.getByRole("link", { name: "Domains" }),
			screen.getByRole("button", { name: "Accounts" }),
		]) {
			const width = number(entry, "focus-visible:outline-");
			// Said outright: a link with no offset of its own gets the
			// browser's 1 px, and the ring's outer line then falls on the
			// entry below, under its fill when that one is the current page.
			const offset = number(entry, "focus-visible:outline-offset-");
			expect([entry.textContent, width, offset]).toEqual([
				entry.textContent,
				2,
				0,
			]);
			expect(width + offset).toBeLessThanOrEqual(room);
			// And the entry with the focus is drawn over its neighbours.
			expect(entry).toHaveClass("relative", "focus-visible:z-10");
		}
	});

	it("lets a caller move the ring off a filled entry, without a second offset left behind", () => {
		render(
			<SidebarProvider>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton className="focus-visible:outline-offset-2">
							Write
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarProvider>,
		);

		const entry = screen.getByRole("button", { name: "Write" });
		expect(entry).toHaveClass("focus-visible:outline-offset-2");
		expect(entry).not.toHaveClass("focus-visible:outline-offset-0");
	});
});
