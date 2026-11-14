import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";

afterEach(cleanup);

/** The message a failing assertion gives, and how long it took to build. */
function failureOf(assertion: () => void): { message: string; ms: number } {
	const started = performance.now();
	try {
		assertion();
	} catch (error) {
		return {
			message: String((error as Error).message),
			ms: performance.now() - started,
		};
	}
	throw new Error("the assertion was expected to fail");
}

/** The busy node, there at first and gone a moment later. */
function Leaves() {
	const [there, setThere] = useState(true);
	useEffect(() => {
		const timer = setTimeout(() => setThere(false), 150);
		return () => clearTimeout(timer);
	}, []);
	return there ? <Busy /> : null;
}

/** How many controls the busy node holds: enough for happy-dom's own print of it to take seconds. */
const CONTROLS = 400;
const ROWS = Array.from({ length: CONTROLS }, (_, index) => `row-${index}`);

/** A node with what makes happy-dom's own print huge: a tree, listeners, a document behind it. */
function Busy() {
	return (
		<section id="box" aria-label="Box">
			<button type="button" onClick={() => {}}>
				Press
			</button>
			<p>{"a long text ".repeat(20)}</p>
			<ul>
				{ROWS.map((row) => (
					<li key={row}>
						<button
							type="button"
							onClick={() => {}}
							onFocus={() => {}}
						>
							{row}
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

describe("a failed assertion on a DOM node", () => {
	it("says which node in a short line, at once", () => {
		render(<Busy />);
		const node = screen.getByRole("region");

		for (const assertion of [
			() => expect(node).toBeNull(),
			() => expect(node).toBe(document.body),
			() => expect(node).not.toBeInTheDocument(),
			() => expect(node).toHaveTextContent("not there"),
			() => expect(node).toHaveFocus(),
		]) {
			const { message, ms } = failureOf(assertion);
			// Kilobytes at most (a matcher may quote the node's text); the
			// print it replaces was hundreds of megabytes.
			expect(message.length).toBeLessThan(20_000);
			expect(ms).toBeLessThan(500);
		}
		expect(failureOf(() => expect(node).toBeNull()).message).toContain(
			'<section id="box" aria-label="Box">Pressa long text',
		);
	});

	it("cuts a long text and names a node that is not an element", () => {
		render(<Busy />);
		const paragraph = screen.getByText(/a long text/);

		const { message } = failureOf(() => expect(paragraph).toBeNull());
		expect(message).toContain("…");
		expect(message).not.toContain("a long text ".repeat(5));
		expect(
			failureOf(() => expect(paragraph.firstChild).toBeNull()).message,
		).toContain("[#text]");
	});

	it("lets waitFor keep polling: a node that goes away a moment after the first failed poll is seen to go", async () => {
		render(<Leaves />);
		expect(screen.getByRole("region")).toBeInTheDocument();

		// The first polls fail on a node. Each must cost almost nothing, or the
		// second that waitFor waits is gone before the node is.
		await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
	});
});
