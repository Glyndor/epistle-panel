"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

/**
 * A modal that asks for a decision before something that cannot be undone. The
 * focus moves to the Cancel button when it opens, stays inside, returns to the
 * control that opened it when it closes, and Escape closes it.
 *
 * A modal Radix dialog locks page scroll with a `<style>` element, which the
 * policy only accepts when it carries the request's nonce, so the app shell
 * mounts `StyleNonce` (`components/layout/style-nonce`) before any dialog opens.
 */
function AlertDialog(
	props: React.ComponentProps<typeof AlertDialogPrimitive.Root>,
) {
	return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

/** The control that opens the dialog. */
function AlertDialogTrigger(
	props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>,
) {
	return (
		<AlertDialogPrimitive.Trigger
			data-slot="alert-dialog-trigger"
			{...props}
		/>
	);
}

/** The backdrop and the dialog box. */
function AlertDialogContent({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
	return (
		<AlertDialogPrimitive.Portal>
			<AlertDialogPrimitive.Overlay
				data-slot="alert-dialog-overlay"
				className="fixed inset-0 z-50 bg-overlay"
			/>
			<AlertDialogPrimitive.Content
				data-slot="alert-dialog-content"
				className={cn(
					"fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-surface-raised p-6 text-foreground shadow-raised",
					className,
				)}
				{...props}
			/>
		</AlertDialogPrimitive.Portal>
	);
}

/** The title and the explanation. */
function AlertDialogHeader({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

/** The row of buttons. */
function AlertDialogFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

/** What is being asked, in a line. */
function AlertDialogTitle({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn("font-semibold text-lg", className)}
			{...props}
		/>
	);
}

/** What the decision does. */
function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn(
				"break-words text-muted-foreground text-sm",
				className,
			)}
			{...props}
		/>
	);
}

/** The confirming button; `variant` follows the button variants. */
function AlertDialogAction({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
	variant?: "default" | "destructive";
}) {
	return (
		<AlertDialogPrimitive.Action
			data-slot="alert-dialog-action"
			className={cn(buttonVariants({ variant }), className)}
			{...props}
		/>
	);
}

/** The button that closes without doing it; it takes the first focus. */
function AlertDialogCancel({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
	return (
		<AlertDialogPrimitive.Cancel
			data-slot="alert-dialog-cancel"
			className={cn(buttonVariants({ variant: "secondary" }), className)}
			{...props}
		/>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
};
