"use client";

import { XIcon } from "lucide-react";
import * as React from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";

/** Elements Tab can reach inside the sheet. */
const FOCUSABLE =
	"a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Keep Tab and Shift+Tab inside the sheet. A native modal dialog makes the page
 * inert, but in a browser with no chrome of its own (and in the measured
 * headless Chromium) focus left the last control for the first element of the
 * page, so the loop is closed by hand.
 */
function trapTab(event: React.KeyboardEvent<HTMLDialogElement>) {
	if (event.key !== "Tab") {
		return;
	}
	const items = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
	);
	const first = items[0];
	const last = items.at(-1);
	if (!first || !last) {
		return;
	}
	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}

/**
 * A panel that slides in from an edge over the page, built on the native modal
 * `<dialog>`. The browser traps focus, makes the rest of the page inert, closes
 * on Escape and returns focus to the opener. A Radix dialog was tried and
 * dropped: its scroll lock injects a `<style>` element that the panel's
 * `style-src 'self'` refuses (a `style-src-elem` violation on every open,
 * measured in the built server). Page scroll is locked in `globals.css` with
 * `body:has(dialog[open])`. There is no animation: the contract is no
 * decorative motion.
 */
export function Sheet({
	open,
	onOpenChange,
	side = "right",
	title,
	description,
	closeLabel,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"dialog">, "title" | "open"> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	side?: "left" | "right";
	/** Name of the sheet for assistive tech, already translated; never shown. */
	title: string;
	/** Short description of the sheet, already translated; never shown. */
	description: string;
	/** Accessible name of the close button, already translated. */
	closeLabel: string;
}) {
	const ref = React.useRef<HTMLDialogElement>(null);
	const id = React.useId();

	React.useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<dialog
			ref={ref}
			data-slot="sheet"
			aria-labelledby={`${id}-title`}
			aria-describedby={`${id}-description`}
			onClose={() => onOpenChange(false)}
			onKeyDown={trapTab}
			onClick={(event) => {
				// A click on the dialog box itself, not on its content, is a click
				// on the backdrop.
				if (event.target === event.currentTarget) {
					onOpenChange(false);
				}
			}}
			className={cn(
				"fixed inset-y-0 m-0 h-svh max-h-none w-3/4 max-w-sm bg-surface-raised p-0 text-foreground shadow-raised backdrop:bg-overlay",
				side === "left"
					? "left-0 rounded-e-2xl"
					: "right-0 left-auto rounded-s-2xl",
				className,
			)}
			{...props}
		>
			<h2 id={`${id}-title`} className="sr-only">
				{title}
			</h2>
			<p id={`${id}-description`} className="sr-only">
				{description}
			</p>
			{children}
			<Tooltip label={closeLabel} align="end">
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-11"
				>
					<XIcon className="size-4" aria-hidden="true" />
					<span className="sr-only">{closeLabel}</span>
				</button>
			</Tooltip>
		</dialog>
	);
}
