"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The round mark that stands for an account. The panel shows initials only:
 * it loads no picture from anywhere, so the image part of the shadcn
 * component was not kept.
 */
function Avatar({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
	size?: "default" | "sm";
}) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			data-size={size}
			className={cn(
				"group/avatar relative flex size-8 shrink-0 select-none overflow-hidden rounded-full data-[size=sm]:size-6",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * What the avatar shows: the initials, on the primary tone. On the secondary
 * one the disc was 1.02 to 1.43:1 against the two headers, measured in the
 * built panel: where only the avatar shows, nothing but a letter marked the
 * button.
 */
function AvatarFallback({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm group-data-[size=sm]/avatar:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

export { Avatar, AvatarFallback };
