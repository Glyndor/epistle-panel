import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { answerConfirm } from "@/test/confirm-dialog";

const { ConfirmAction } = await import(".");

afterEach(cleanup);

function setup(onConfirm = () => {}, destructive?: boolean) {
	render(
		<ConfirmAction
			description="Remove it?"
			onConfirm={onConfirm}
			{...(destructive === undefined ? {} : { destructive })}
		>
			<button type="button">Remove</button>
		</ConfirmAction>,
	);
}

describe("ConfirmAction", () => {
	it("does not act until the person opens the dialog and confirms", async () => {
		const onConfirm = mock(() => {});
		setup(onConfirm);

		expect(onConfirm).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(await screen.findByRole("alertdialog")).toHaveTextContent(
			"Remove it?",
		);
		await answerConfirm(true);

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("does nothing when declined, and the control keeps the focus", async () => {
		const onConfirm = mock(() => {});
		setup(onConfirm);
		const control = screen.getByRole("button", { name: "Remove" });
		control.focus();
		fireEvent.click(control);
		await answerConfirm(false);

		expect(onConfirm).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("looks destructive unless told otherwise", async () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(
			await screen.findByRole("button", { name: "proceed" }),
		).toHaveClass("bg-destructive");
		await answerConfirm(false);
		cleanup();

		setup(() => {}, false);
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(
			await screen.findByRole("button", { name: "proceed" }),
		).toHaveClass("bg-primary");
	});
});
