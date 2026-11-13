import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { useLazyPanel } from ".";

afterEach(() => {
	cleanup();
	clearToasts();
});

function Panel({ how }: { how: string | undefined }) {
	return <output>{`panel opened by ${how}`}</output>;
}

/** A button that warms on focus and opens on a press, as a header's menu button does. */
function Probe({ load }: { load: () => Promise<typeof Panel> }) {
	return (
		<>
			<Button load={load} />
			<Toaster label="toasts" closeLabel="close" />
		</>
	);
}

function Button({ load }: { load: () => Promise<typeof Panel> }) {
	const lazy = useLazyPanel(load, "could not load");
	if (lazy.panel !== undefined) {
		const Loaded = lazy.panel;
		return <Loaded how={lazy.press} />;
	}
	return (
		<button
			type="button"
			aria-busy={lazy.loading}
			onFocus={lazy.warm}
			onClick={(event) =>
				lazy.open(event.detail === 0 ? "keyboard" : "pointer")
			}
		>
			open
		</button>
	);
}

describe("useLazyPanel", () => {
	it("shows nothing of the panel, and loads nothing, until it is asked for", () => {
		const load = mock(async () => Panel);
		render(<Probe load={load} />);

		expect(screen.getByRole("button", { name: "open" })).toHaveAttribute(
			"aria-busy",
			"false",
		);
		expect(load).not.toHaveBeenCalled();
	});

	it("warms the download without showing the panel", async () => {
		const load = mock(async () => Panel);
		render(<Probe load={load} />);

		fireEvent.focus(screen.getByRole("button", { name: "open" }));
		await Promise.resolve();

		expect(load).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole("button", { name: "open" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("is busy while the code is on its way, then shows the panel and says how it was asked for", async () => {
		let arrive: (panel: typeof Panel) => void = () => {};
		const load = () =>
			new Promise<typeof Panel>((resolve) => {
				arrive = resolve;
			});
		render(<Probe load={load} />);

		fireEvent.click(screen.getByRole("button", { name: "open" }), {
			detail: 0,
		});
		expect(screen.getByRole("button", { name: "open" })).toHaveAttribute(
			"aria-busy",
			"true",
		);

		arrive(Panel);
		expect(await screen.findByRole("status")).toHaveTextContent(
			"panel opened by keyboard",
		);
	});

	it("tells a pointer press from a keyboard one", async () => {
		render(<Probe load={async () => Panel} />);

		fireEvent.click(screen.getByRole("button", { name: "open" }), {
			detail: 1,
		});

		expect(await screen.findByRole("status")).toHaveTextContent(
			"panel opened by pointer",
		);
	});

	it("keeps the button, says so and lets the next press try again when the code cannot be fetched", async () => {
		let attempts = 0;
		const load = async () => {
			attempts += 1;
			if (attempts === 1) {
				throw new Error("ChunkLoadError");
			}
			return Panel;
		};
		render(<Probe load={load} />);
		const button = screen.getByRole("button", { name: "open" });

		fireEvent.click(button, { detail: 1 });
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"could not load",
		);

		// The same button is still there, no longer busy, and nothing was thrown.
		expect(screen.getByRole("button", { name: "open" })).toBe(button);
		await waitFor(() =>
			expect(button).toHaveAttribute("aria-busy", "false"),
		);
		expect(screen.queryByRole("status")).toBeNull();

		fireEvent.click(button, { detail: 1 });
		expect(await screen.findByRole("status")).toBeInTheDocument();
		expect(screen.getAllByRole("alert")).toHaveLength(1);
	});

	it("does not report a failed warm-up: only a press that fails is said", async () => {
		const load = mock(async () => {
			throw new Error("offline");
		});
		render(<Probe load={load as unknown as () => Promise<typeof Panel>} />);

		fireEvent.focus(screen.getByRole("button", { name: "open" }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(load).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
