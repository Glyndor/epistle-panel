import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	THEME_CHOICES,
	type ThemeChoice,
} from "@/features/theme/config/choices";
import { ThemeOptions } from ".";

afterEach(cleanup);

function renderOptions(
	choice: ThemeChoice,
	onChoose: (value: string) => void = () => {},
) {
	return render(
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger>open</DropdownMenuTrigger>
			<DropdownMenuContent>
				<ThemeOptions choice={choice} onChoose={onChoose} />
			</DropdownMenuContent>
		</DropdownMenu>,
	);
}

describe("ThemeOptions", () => {
	it("lists the three choices in a named group, the current one checked", async () => {
		for (const current of THEME_CHOICES) {
			renderOptions(current);

			const items = await screen.findAllByRole("menuitemradio");
			expect(items.map((item) => item.textContent)).toEqual([
				"theme_system",
				"theme_light",
				"theme_dark",
			]);
			expect(
				items.map((item) => item.getAttribute("aria-checked")),
			).toEqual(THEME_CHOICES.map((value) => String(value === current)));
			expect(
				screen.getByRole("group", { name: "theme" }),
			).toBeInTheDocument();
			cleanup();
		}
	});

	it("reports the value of the item that is picked", async () => {
		const onChoose = mock((_value: string) => {});
		renderOptions("system", onChoose);

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_dark" }),
		);

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose.mock.calls[0]?.[0]).toBe("dark");
	});

	it("keeps rows of 32 px on a fine pointer and 44 px on a coarse one", async () => {
		renderOptions("light");

		for (const item of await screen.findAllByRole("menuitemradio")) {
			expect(item).toHaveClass("min-h-8");
			expect(item).toHaveClass("pointer-coarse:min-h-11");
		}
	});

	it("makes its items wait while a choice is being stored", async () => {
		const onChoose = mock((_value: string) => {});
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<ThemeOptions
						choice="system"
						onChoose={onChoose}
						disabled
					/>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		const items = await screen.findAllByRole("menuitemradio");
		for (const item of items) {
			expect(item).toHaveAttribute("aria-disabled", "true");
		}
		fireEvent.click(items[2] as HTMLElement);
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("gives each choice its icon, the one the theme button shows, and the heading one too, all hidden from assistive tech", async () => {
		renderOptions("light");

		const items = await screen.findAllByRole("menuitemradio");
		for (const item of items) {
			const icons = item.querySelectorAll("svg");
			expect(icons).toHaveLength(1);
			expect(icons[0]).toHaveAttribute("aria-hidden", "true");
			expect(item).toHaveClass("[&_svg]:size-4");
		}
		expect(
			items.map((item) =>
				[...(item.querySelector("svg")?.classList ?? [])].find((name) =>
					name.startsWith("lucide-"),
				),
			),
		).toEqual(["lucide-monitor", "lucide-sun", "lucide-moon"]);
		const heading = screen.getByText("theme");
		expect(heading.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});
});
