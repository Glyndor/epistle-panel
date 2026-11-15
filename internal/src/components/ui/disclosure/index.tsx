"use client";

import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

/**
 * A part of the page that opens and closes under a button, drawn by the
 * browser: a `details` and its `summary`. The button is the summary, and the
 * browser opens and closes the part with it before any script has loaded, so
 * a part that must be there without script uses this and not the collapsible,
 * which needs one.
 *
 * The script only adds what the browser does not do: Escape closes the part
 * and gives the focus back to its button, and a press outside it closes it.
 * The open state is the browser's own: the part is opened and closed by
 * changing the attribute, and the browser hides what is inside while it is
 * closed, so nothing of it is painted and nothing of it is in the tab order.
 */
function Disclosure({
	className,
	children,
	...props
}: React.ComponentProps<"details">) {
	const details = useRef<HTMLDetailsElement>(null);

	// Escape closes the part and gives the focus back to its button.
	const onKeyDown = (event: React.KeyboardEvent<HTMLDetailsElement>) => {
		props.onKeyDown?.(event);
		const element = details.current;
		if (event.key !== "Escape" || element === null || !element.open) {
			return;
		}
		event.stopPropagation();
		element.open = false;
		element.querySelector("summary")?.focus();
	};

	// A press outside the part closes it, and the focus stays where the press
	// went: the person pressed something else.
	useEffect(() => {
		const element = details.current;
		if (element === null) {
			return;
		}
		const onPointerDown = (event: Event) => {
			if (!element.open) {
				return;
			}
			const target = event.target;
			if (target instanceof Node && element.contains(target)) {
				return;
			}
			element.open = false;
		};
		// Keep the explicit state in step with native activation, including
		// the summary's click and Space, without controlling `open` in React.
		const syncExpanded = () => {
			element
				.querySelector("summary")
				?.setAttribute("aria-expanded", String(element.open));
		};
		syncExpanded();
		element.addEventListener("toggle", syncExpanded);
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("click", onPointerDown);
		document.addEventListener("focusin", onPointerDown);
		return () => {
			element.removeEventListener("toggle", syncExpanded);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("click", onPointerDown);
			document.removeEventListener("focusin", onPointerDown);
		};
	}, []);

	return (
		<details
			{...props}
			ref={details}
			data-slot="disclosure"
			className={className}
			onKeyDown={onKeyDown}
		>
			{children}
		</details>
	);
}

/**
 * The button that opens and closes the part: the summary of the details, with
 * the look of a button of the panel.
 *
 * The browser's own activation of the summary opens and closes the part, and
 * it does it before any script has loaded: the click is left to it.
 */
function DisclosureTrigger({
	className,
	children,
	...props
}: React.ComponentProps<"summary">) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: a summary is the button of a disclosure, and the browser gives it that role.
		<summary
			{...props}
			data-slot="disclosure-trigger"
			className={cn(
				buttonVariants({ variant: "ghost", size: "icon" }),
				"list-none",
				className,
			)}
			onKeyDown={(event) => {
				props.onKeyDown?.(event);
				// Space opens and closes the part as well: the browser does
				// not do it for a summary, and the space would scroll the
				// page instead.
				if (event.key !== " ") {
					return;
				}
				event.preventDefault();
				const element =
					event.currentTarget.closest<HTMLDetailsElement>("details");
				if (element !== null) {
					element.open = !element.open;
				}
			}}
		>
			{children}
		</summary>
	);
}

/** What opens and closes. */
function DisclosureContent({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div {...props} data-slot="disclosure-content" className={className}>
			{children}
		</div>
	);
}

export { Disclosure, DisclosureContent, DisclosureTrigger };
