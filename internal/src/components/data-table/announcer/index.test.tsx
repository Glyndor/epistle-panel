import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";

import { DataTableAnnouncer } from ".";

beforeEach(() => {
	jest.useFakeTimers();
});
afterEach(() => {
	cleanup();
	jest.useRealTimers();
});

/** Let `ms` fake milliseconds pass, and React draw what the timers did. */
const pass = (ms: number) =>
	act(() => {
		jest.advanceTimersByTime(ms);
	});

function setup(message: string) {
	const view = render(<DataTableAnnouncer message={message} />);
	const region = view.container.querySelector("p") as HTMLElement;
	const say = (next: string) =>
		view.rerender(<DataTableAnnouncer message={next} />);
	return { region, say };
}

describe("DataTableAnnouncer", () => {
	it("is a polite live region read whole, kept off the screen", () => {
		const { region } = setup("1–25 of 132");

		expect(region).toHaveAttribute("aria-live", "polite");
		expect(region).toHaveAttribute("aria-atomic", "true");
		expect(region).toHaveClass("sr-only");
	});

	it("says nothing of the first paint, however long it is left", () => {
		const { region } = setup("1–25 of 132");

		expect(region.textContent).toBe("");
		// At the moment a change would be said, and well after it.
		pass(500);
		expect(region.textContent).toBe("");
		pass(1000);
		expect(region.textContent).toBe("");
		pass(10_000);
		expect(region.textContent).toBe("");
	});

	it("says a change half a second after it, not before", () => {
		const { region, say } = setup("1–25 of 132");

		say("26–50 of 132");
		expect(region.textContent).toBe("");
		pass(499);
		expect(region.textContent).toBe("");
		pass(1);
		expect(region.textContent).toBe("26–50 of 132");
	});

	it("says a run of changes once, with the last of them", () => {
		const { region, say } = setup("132 of 132 rows");
		const seen: string[] = [];
		const watch = () => {
			if (region.textContent !== seen.at(-1)) {
				seen.push(region.textContent ?? "");
			}
		};
		watch();

		// Seven letters typed 100 ms apart, each narrowing the rows.
		for (const count of [90, 61, 40, 22, 9, 3, 1]) {
			say(`${count} of 132 rows`);
			pass(100);
			watch();
		}
		pass(399);
		watch();
		expect(seen).toEqual([""]);

		pass(1);
		watch();
		expect(seen).toEqual(["", "1 of 132 rows"]);
	});

	it("empties the sentence 2.5 seconds after saying it, so the page holds it once", () => {
		const { region, say } = setup("1–25 of 132");

		say("No row matches the filter.");
		pass(500);
		expect(region.textContent).toBe("No row matches the filter.");
		pass(2499);
		expect(region.textContent).toBe("No row matches the filter.");
		pass(1);
		expect(region.textContent).toBe("");
	});

	it("says the same sentence again when the rows come back to it", () => {
		const { region, say } = setup("1–25 of 132");

		say("26–50 of 132");
		pass(3000);
		say("1–25 of 132");
		pass(500);
		expect(region.textContent).toBe("1–25 of 132");
	});
});
