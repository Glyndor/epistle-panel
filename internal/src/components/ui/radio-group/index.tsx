"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A set of choices of which one is taken. The arrow keys move between them and
 * take the one they land on; Tab enters and leaves the group as one stop. Name
 * the group with `aria-label` or `aria-labelledby`.
 */
function RadioGroup({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
	return (
		<RadioGroupPrimitive.Root
			data-slot="radio-group"
			className={cn("grid gap-2", className)}
			{...props}
		/>
	);
}

/**
 * One choice: a round control, 16 px on a fine pointer and 24 px inside a
 * 44 px row on a coarse one (the row is the label around it). Give it an `id`
 * and a `Label` with the same `htmlFor`, or put both in a `label`.
 */
function RadioGroupItem({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
	return (
		<RadioGroupPrimitive.Item
			data-slot="radio-group-item"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center rounded-full bg-field text-primary shadow-[inset_0_0_0_2px_var(--field-edge)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:shadow-[inset_0_0_0_2px_var(--primary)] pointer-coarse:size-6",
				className,
			)}
			{...props}
		>
			<RadioGroupPrimitive.Indicator
				data-slot="radio-group-indicator"
				className="block size-2 rounded-full bg-current pointer-coarse:size-3"
			/>
		</RadioGroupPrimitive.Item>
	);
}

export { RadioGroup, RadioGroupItem };
