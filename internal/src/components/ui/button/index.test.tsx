import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Button, buttonVariants } from ".";

afterEach(cleanup);

describe("Button", () => {
	it("renders a native button that runs its click handler", () => {
		const onClick = mock(() => {});
		render(<Button onClick={onClick}>Save</Button>);

		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("does not run its click handler while disabled", () => {
		const onClick = mock(() => {});
		render(
			<Button disabled onClick={onClick}>
				Save
			</Button>,
		);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("renders its child element instead of a button with asChild", () => {
		render(
			<Button asChild variant="link">
				<a href="/queue">Queue</a>
			</Button>,
		);

		const link = screen.getByRole("link", { name: "Queue" });
		expect(link).toHaveAttribute("href", "/queue");
		expect(screen.queryByRole("button")).toBeNull();
		expect(link).toHaveAttribute("data-variant", "link");
	});

	it("is compact on a fine pointer and keeps a 44px target on a coarse one", () => {
		// happy-dom computes no layout, so the contract is the utility class:
		// `pointer-coarse:min-h-11` is 2.75rem, 44px at the default root size.
		// The rendered size is measured in a real browser with touch emulation.
		const minimums = {
			default: "pointer-coarse:min-h-11",
			sm: "pointer-coarse:min-h-11",
			lg: "pointer-coarse:min-h-12",
			icon: "pointer-coarse:size-11",
		} as const;
		for (const [size, minimum] of Object.entries(minimums)) {
			expect(
				buttonVariants({ size: size as keyof typeof minimums }),
			).toContain(minimum);
		}
	});

	it("underlines the link variant at rest and changes it on hover", () => {
		// A link whose hover looks like its rest state has no hover feedback.
		const classes = buttonVariants({ variant: "link" });
		expect(classes).toContain("underline");
		expect(classes).toContain("hover:no-underline");
		expect(classes).toContain("active:text-primary/70");
	});

	it("gives every variant a hover and a press fill that differ from each other and from rest", () => {
		// A hover that equals the rest state, or a press that equals the hover,
		// is no feedback. The fills are read from the classes: the colours they
		// name are held apart in `styles/pointer-tokens.test.ts`.
		const fill = (classes: string, state: "hover" | "active") =>
			classes
				.split(" ")
				.find((name) => name.startsWith(`${state}:bg-`))
				?.slice(state.length + 1);
		for (const variant of [
			"default",
			"destructive",
			"outline",
			"secondary",
			"ghost",
		] as const) {
			const classes = buttonVariants({ variant });
			const rest = classes
				.split(" ")
				.find((name) => name.startsWith("bg-"))
				?.slice(3);
			const hover = fill(classes, "hover");
			const press = fill(classes, "active");

			expect(hover, variant).toBeDefined();
			expect(press, variant).toBeDefined();
			expect(hover?.replace("bg-", ""), variant).not.toBe(rest);
			expect(press, variant).not.toBe(hover);
		}
	});

	it("presses a ghost, an outline and a secondary button one step deeper than their hover", () => {
		expect(buttonVariants({ variant: "ghost" })).toContain(
			"active:bg-accent-press",
		);
		expect(buttonVariants({ variant: "outline" })).toContain(
			"hover:bg-secondary-hover",
		);
		expect(buttonVariants({ variant: "outline" })).toContain(
			"active:bg-secondary-press",
		);
		expect(buttonVariants({ variant: "secondary" })).toContain(
			"hover:bg-secondary-hover",
		);
		expect(buttonVariants({ variant: "secondary" })).toContain(
			"active:bg-secondary-press",
		);
	});

	it("lets a caller class override a variant utility", () => {
		render(<Button className="px-2">Save</Button>);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toHaveClass("px-2");
		expect(button).not.toHaveClass("px-4");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Button>Save</Button>);

		expect(screen.getByRole("button")).not.toHaveAttribute("style");
	});
});
