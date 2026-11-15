import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
	DropdownMenuGroup,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { FilterMenu } from ".";

afterEach(cleanup);

function draw(active = 0) {
	const toggle = mock(() => {});
	const clear = mock(() => {});
	render(
		<main id="main-content">
			<div data-testid="toolbar">
				<FilterMenu
					label="Narrow results"
					activeLabel={`${active} selected`}
					clearLabel="Reset choices"
					active={active}
					groups={[
						{
							id: "status",
							label: "Status",
							options: [
								{
									value: "on",
									label: "On",
									checked: true,
									onToggle: toggle,
								},
								{
									value: "off",
									label: "Off",
									checked: false,
									onToggle: toggle,
								},
							],
						},
					]}
					onClear={clear}
				>
					<DropdownMenuGroup aria-label="Extra">
						<DropdownMenuLabel>Caller content</DropdownMenuLabel>
					</DropdownMenuGroup>
				</FilterMenu>
			</div>
		</main>,
	);
	return {
		toggle,
		clear,
		trigger: screen.getByRole("button", { name: /Narrow results/ }),
	};
}
async function open(trigger: HTMLElement) {
	fireEvent.keyDown(trigger, { key: "Enter" });
	return screen.findByRole("menu");
}

describe("shared FilterMenu presentation", () => {
	it("uses caller labels, hides an empty count and keeps the shared trigger layout", () => {
		const { trigger } = draw();
		expect(trigger).toHaveAccessibleName("Narrow results");
		expect(trigger.querySelector('[data-slot="badge"]')).toBeNull();
		expect(trigger).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});
	it("shows the count, speaks its supplied label, groups checks and composes extras before clear", async () => {
		const { trigger } = draw(2);
		expect(trigger).toHaveAccessibleName("Narrow results 2 selected");
		const badge = trigger.querySelector('[data-slot="badge"]');
		expect(badge).toHaveTextContent("2");
		expect(badge).toHaveAttribute("aria-hidden", "true");
		const before = document.querySelectorAll("style").length;
		const menu = await open(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("group", { name: "Status" })).toContainElement(
			screen.getByRole("menuitemcheckbox", { name: "On" }),
		);
		expect(
			screen.getByRole("menuitemcheckbox", { name: "On" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			screen.getByRole("menuitemcheckbox", { name: "Off" }),
		).toHaveAttribute("aria-checked", "false");
		expect(
			screen
				.getByRole("group", { name: "Extra" })
				.compareDocumentPosition(
					screen.getByRole("menuitem", { name: "Reset choices" }),
				) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(document.getElementById("main-content")).toContainElement(menu);
		expect(screen.getByTestId("toolbar")).not.toContainElement(menu);
		expect(document.querySelectorAll("style")).toHaveLength(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
	});
	it("reports a checkbox once and keeps the menu open for more choices", async () => {
		const { trigger, toggle } = draw();
		await open(trigger);
		fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Off" }));
		expect(toggle).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});
	it.each([0, 1])(
		"enables clear only for an active count (%s)",
		async (active) => {
			const { trigger, clear } = draw(active);
			await open(trigger);
			const item = screen.getByRole("menuitem", {
				name: "Reset choices",
			});
			expect(item.getAttribute("aria-disabled")).toBe(
				active === 0 ? "true" : null,
			);
			fireEvent.click(item);
			expect(clear).toHaveBeenCalledTimes(active === 0 ? 0 : 1);
		},
	);
});
