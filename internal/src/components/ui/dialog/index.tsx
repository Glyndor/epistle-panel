"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A modal for a task that belongs to the page behind it, a form most of the
 * time. The focus moves inside when it opens, stays there, returns to the
 * control that opened it when it closes, and Escape or the close button closes
 * it. For a decision that cannot be undone use `AlertDialog`, which has no
 * close button and cannot be dismissed by a click outside.
 *
 * Like every modal Radix overlay it locks page scroll with a `<style>` element,
 * which the policy accepts only with the request's nonce: the shell that hosts
 * it mounts `StyleNonce` (`components/layout/style-nonce`).
 */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The control that opens the dialog. */
function DialogTrigger(
	props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** A control inside the dialog that closes it. */
function DialogClose(
	props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/**
 * The backdrop and the dialog box, with its close button. `closeLabel` is the
 * button's name for a screen reader. The box scrolls when its content is taller
 * than the window.
 */
function DialogContent({
	className,
	children,
	closeLabel,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	closeLabel: string;
}) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay
				data-slot="dialog-overlay"
				className="fixed inset-0 z-50 bg-overlay"
			/>
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					"fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl bg-surface-raised p-6 text-foreground shadow-raised",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close
					data-slot="dialog-close"
					className="absolute top-3 right-3 inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&_svg]:size-4"
				>
					<XIcon aria-hidden="true" />
					<span className="sr-only">{closeLabel}</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

/** The title and the explanation. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2 pr-8", className)}
			{...props}
		/>
	);
}

/** The row of buttons. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

/** What the dialog is for, in a line. */
function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("font-semibold text-lg", className)}
			{...props}
		/>
	);
}

/** What it does, or what to fill in. */
function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"break-words text-muted-foreground text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
};
