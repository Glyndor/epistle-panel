import { afterEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";

import { clearToasts, TOAST_DURATION_MS, Toaster, toast } from ".";

afterEach(() => {
	cleanup();
	clearToasts();
});

function renderToaster() {
	return render(<Toaster label="Notifications" closeLabel="Dismiss" />);
}

describe("Toaster", () => {
	it("is an always-present, named region with nothing in it", () => {
		renderToaster();

		expect(
			screen.getByRole("region", { name: "Notifications" }),
		).toBeEmptyDOMElement();
	});

	it("announces a success politely and an error at once", () => {
		renderToaster();

		act(() => {
			toast.success("Removed");
			toast.error("Failed");
		});

		expect(screen.getByRole("status")).toHaveTextContent("Removed");
		expect(screen.getByRole("alert")).toHaveTextContent("Failed");
	});

	it("dismisses a toast with its translated close button", () => {
		renderToaster();
		act(() => {
			toast.success("Removed");
		});

		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("dismisses itself after its time, an error later than a success", async () => {
		renderToaster();
		expect(TOAST_DURATION_MS.error).toBeGreaterThan(
			TOAST_DURATION_MS.success,
		);
		const original = globalThis.setTimeout;
		const scheduled: Array<{ fn: () => void; ms: number }> = [];
		globalThis.setTimeout = ((fn: () => void, ms: number) => {
			scheduled.push({ fn, ms });
			return 0;
		}) as unknown as typeof setTimeout;
		try {
			act(() => {
				toast.success("Removed");
			});
			const timeout = scheduled.find(
				(entry) => entry.ms === TOAST_DURATION_MS.success,
			);
			expect(timeout).toBeDefined();
			act(() => timeout?.fn());
		} finally {
			globalThis.setTimeout = original;
		}

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("keeps at most four toasts, dropping the oldest", () => {
		renderToaster();

		act(() => {
			for (const n of [1, 2, 3, 4, 5]) {
				toast.success(`m${n}`);
			}
		});

		expect(screen.getAllByRole("status")).toHaveLength(4);
		expect(screen.queryByText("m1")).toBeNull();
		expect(screen.getByText("m5")).toBeInTheDocument();
	});

	it("ignores dismissing an id that is gone, and uses classes only", () => {
		const { container } = renderToaster();
		act(() => {
			toast.success("Removed");
			toast.dismiss(999);
		});

		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
