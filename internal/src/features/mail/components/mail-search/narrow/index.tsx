"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";

/**
 * The search of the mail area on a narrow window: an icon in the header that
 * opens the field over the header, and a control that takes it back. From
 * 1024 px up the field is in the bar itself, where there is room for it, and
 * this draws nothing but the field.
 *
 * While the field is open the panel covers the bar, so the bar's other parts
 * are made inert: they are behind it and are not reached by the keyboard
 * either. The field takes the focus when the panel opens, and the icon takes
 * it back when it closes.
 */
export function NarrowSearch({
	label,
	closeLabel,
	children,
}: {
	/** The name of the search, already translated. */
	label: string;
	/** The name of the control that closes the field, already translated. */
	closeLabel: string;
	/** The search itself, drawn by the server. */
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const cell = useRef<HTMLDivElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const opener = useRef<HTMLButtonElement>(null);

	// The bar's other parts are behind the panel: they are not reached.
	useEffect(() => {
		const bar = cell.current?.closest("header");
		if (!open || bar === undefined || bar === null) {
			return;
		}
		const others = Array.from(bar.children).filter(
			(child) => child !== cell.current,
		);
		for (const other of others) {
			other.setAttribute("inert", "");
		}
		return () => {
			for (const other of others) {
				other.removeAttribute("inert");
			}
		};
	}, [open]);

	// The field takes the focus when the panel opens; the icon takes it back.
	useEffect(() => {
		if (open) {
			panel.current?.querySelector<HTMLInputElement>("input")?.focus();
		}
	}, [open]);

	// Escape closes the panel: the field is the only thing that can be
	// reached while it is open, so the key is heard wherever the focus is.
	useEffect(() => {
		if (!open) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				opener.current?.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	const close = () => {
		setOpen(false);
		opener.current?.focus();
	};

	return (
		<div ref={cell} className="min-w-0 flex-1">
			<Tooltip label={label} align="end">
				<Button
					ref={opener}
					type="button"
					variant="ghost"
					size="icon"
					className="lg:hidden"
					aria-expanded={open}
					onClick={() => setOpen(true)}
				>
					<SearchIcon aria-hidden="true" />
					<span className="sr-only">{label}</span>
				</Button>
			</Tooltip>
			<div
				ref={panel}
				className={cn(
					open
						? "absolute inset-0 z-30 flex items-center gap-2 bg-header px-2 md:px-4"
						: "hidden lg:flex lg:items-center lg:gap-2",
				)}
			>
				{children}
				{open ? (
					<Tooltip label={closeLabel} align="end">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={close}
						>
							<XIcon aria-hidden="true" />
							<span className="sr-only">{closeLabel}</span>
						</Button>
					</Tooltip>
				) : null}
			</div>
		</div>
	);
}
