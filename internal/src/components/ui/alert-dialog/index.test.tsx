import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from ".";

afterEach(cleanup);

function setup(onAction = () => {}) {
	return render(
		<AlertDialog>
			<AlertDialogTrigger>Open</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Sure?</AlertDialogTitle>
					<AlertDialogDescription>
						It cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>No</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={onAction}>
						Yes
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>,
	);
}

describe("AlertDialog", () => {
	it("opens as a named modal with its description, on a raised surface with a shadow and no border", async () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Open" }));

		const dialog = await screen.findByRole("alertdialog", {
			name: "Sure?",
		});
		expect(dialog).toHaveAccessibleDescription("It cannot be undone.");
		expect(dialog).toHaveClass("bg-surface-raised", "shadow-raised");
		expect(dialog).not.toHaveClass("border");
	});

	it("puts the first focus on Cancel and closes on Escape, returning the focus", async () => {
		setup();
		const trigger = screen.getByRole("button", { name: "Open" });
		trigger.focus();
		fireEvent.click(trigger);

		const cancel = await screen.findByRole("button", { name: "No" });
		await waitFor(() => expect(document.activeElement).toBe(cancel));
		fireEvent.keyDown(cancel, { key: "Escape" });

		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		await waitFor(() => expect(document.activeElement).toBe(trigger));
	});

	it("runs the action only when confirmed, with the variant's look", async () => {
		const action = mock(() => {});
		setup(action);
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		const yes = await screen.findByRole("button", { name: "Yes" });

		expect(yes).toHaveClass("bg-destructive");
		expect(action).not.toHaveBeenCalled();
		fireEvent.click(yes);

		expect(action).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
	});

	it("keeps the default action look when no variant is given", async () => {
		render(
			<AlertDialog defaultOpen>
				<AlertDialogContent>
					<AlertDialogTitle>t</AlertDialogTitle>
					<AlertDialogDescription>d</AlertDialogDescription>
					<AlertDialogAction>Go</AlertDialogAction>
				</AlertDialogContent>
			</AlertDialog>,
		);

		expect(await screen.findByRole("button", { name: "Go" })).toHaveClass(
			"bg-primary",
		);
	});
});
