"use client";

import { Rows2Icon, Rows4Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { setListDensity } from "@/features/mail/actions/set-list-density";
import {
	LIST_DENSITY_ATTRIBUTE,
	type ListDensity,
} from "@/features/mail/config/list-density";

/**
 * The switch between the comfortable and the compact list, small, in the
 * list's toolbar. A change shows at once: it sets the density attribute of the
 * list pane, which is what every row reads, and is then stored by the Server
 * Action, which validates it again and is the real gate. If the action
 * refuses (the session ended, say) the previous density comes back and a
 * toast says so. One change at a time: a press made while another is being
 * stored is dropped, and the button says it is busy without losing the focus.
 * Pressed, it stands on the accent surface, and the pointer on it darkens it
 * a step more, so the two are not one look.
 *
 * `density` is what the server read from the cookie and painted on the pane.
 */
export function DensityToggle({ density }: { density: ListDensity }) {
	const t = useTranslations("mail");
	const [shown, setShown] = useState(density);
	const [fromServer, setFromServer] = useState(density);
	const [pending, startTransition] = useTransition();
	const button = useRef<HTMLButtonElement>(null);
	if (fromServer !== density) {
		// The pane was rendered again with another choice (made in another tab).
		setFromServer(density);
		setShown(density);
	}
	const compact = shown === "compact";

	const show = (value: ListDensity) => {
		button.current
			?.closest(`[${LIST_DENSITY_ATTRIBUTE}]`)
			?.setAttribute(LIST_DENSITY_ATTRIBUTE, value);
		setShown(value);
	};
	const toggle = () => {
		if (pending) {
			return;
		}
		const previous = shown;
		const next: ListDensity = compact ? "comfortable" : "compact";
		show(next);
		startTransition(async () => {
			const stored = await setListDensity(next).catch(() => false);
			if (!stored) {
				show(previous);
				toast.error(t("densityFailed"));
			}
		});
	};

	return (
		<Tooltip label={t("densityCompact")} side="bottom" align="end">
			<Button
				ref={button}
				type="button"
				variant="ghost"
				size="icon"
				aria-pressed={compact}
				aria-disabled={pending ? true : undefined}
				onClick={toggle}
				className="hover:bg-foreground/10 active:bg-foreground/15 aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-foreground/15"
			>
				{compact ? (
					<Rows4Icon aria-hidden="true" />
				) : (
					<Rows2Icon aria-hidden="true" />
				)}
				<span className="sr-only">{t("densityCompact")}</span>
			</Button>
		</Tooltip>
	);
}
