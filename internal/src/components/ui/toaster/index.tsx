"use client";

import { XIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

/** What a toast reports. An error is announced at once; the rest politely. */
export type ToastKind = "success" | "error";

interface ToastItem {
	readonly id: number;
	readonly kind: ToastKind;
	readonly message: string;
}

/** Milliseconds a toast stays before it dismisses itself, by kind. */
export const TOAST_DURATION_MS: Record<ToastKind, number> = {
	success: 5_000,
	error: 8_000,
};

/** Most toasts shown at once; a newer one pushes the oldest out. */
const MAX_TOASTS = 4;

let items: readonly ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(next: readonly ToastItem[]): void {
	items = next;
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function show(kind: ToastKind, message: string): number {
	const id = nextId++;
	emit([...items, { id, kind, message }].slice(-MAX_TOASTS));
	return id;
}

/** Remove a toast by id. Unknown ids are ignored. */
function dismiss(id: number): void {
	emit(items.filter((item) => item.id !== id));
}

/**
 * Show a message to the person using the panel. Call it from an event handler or
 * a mutation callback. The text must already be translated and must carry no
 * secret: it is announced to assistive technology and shown on screen.
 */
export const toast = {
	success: (message: string) => show("success", message),
	error: (message: string) => show("error", message),
	dismiss,
};

/** Forget every toast. Tests call it between cases. */
export function clearToasts(): void {
	emit([]);
	nextId = 1;
}

/**
 * A toast the panel draws itself. Sonner was measured first and rejected: it
 * injects a `<style>` element when it loads, which `style-src 'self'` blocks (a
 * `style-src-elem` violation each time). This one is classes only, with no
 * animation. A success is a polite `status`, an error is an `alert`, each stays
 * until dismissed or timed out, and the timer pauses while the pointer or the
 * keyboard focus is on it.
 */
function ToastView({
	item,
	closeLabel,
}: {
	item: ToastItem;
	closeLabel: string;
}) {
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const start = () => {
		clearTimeout(timer.current);
		timer.current = setTimeout(
			() => dismiss(item.id),
			TOAST_DURATION_MS[item.kind],
		);
	};
	const pause = () => clearTimeout(timer.current);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the timer starts once per toast
	useEffect(() => {
		start();
		return pause;
	}, []);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover and focus only pause the timer; every action stays on the close button
		<div
			role={item.kind === "error" ? "alert" : "status"}
			data-kind={item.kind}
			onPointerEnter={pause}
			onPointerLeave={start}
			onFocus={pause}
			onBlur={start}
			className="flex items-start gap-2 rounded-xl bg-popover p-3 text-popover-foreground text-sm shadow-raised data-[kind=error]:bg-destructive-soft data-[kind=error]:text-destructive"
		>
			<p className="min-w-0 flex-1 break-words">{item.message}</p>
			<button
				type="button"
				onClick={() => dismiss(item.id)}
				className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-11"
			>
				<XIcon className="size-4" aria-hidden="true" />
				<span className="sr-only">{closeLabel}</span>
			</button>
		</div>
	);
}

/**
 * The one region that holds the toasts, rendered once in the app shell. It is a
 * named landmark that is always present, so a live region exists before the
 * first message arrives. Both texts come translated from the server.
 */
export function Toaster({
	label,
	closeLabel,
}: {
	label: string;
	closeLabel: string;
}) {
	const current = useSyncExternalStore(
		subscribe,
		() => items,
		() => items,
	);

	return (
		<section
			aria-label={label}
			className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
		>
			{current.map((item) => (
				<div key={item.id} className="pointer-events-auto w-full">
					<ToastView item={item} closeLabel={closeLabel} />
				</div>
			))}
		</section>
	);
}
