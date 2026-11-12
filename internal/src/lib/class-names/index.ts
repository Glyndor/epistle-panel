import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves Tailwind conflicts, so the last utility wins
 * (`cn("px-4", "px-2")` gives `px-2`). Every component under `components/ui`
 * runs its `className` prop through it, which is what lets a caller override a
 * variant.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
