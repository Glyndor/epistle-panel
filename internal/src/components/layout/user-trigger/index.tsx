import { useTranslations } from "next-intl";
import type * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";
import { initials } from "@/lib/initials";

/**
 * The button of the profile menu: the account's initials and, where the bar
 * has room, its name. Its accessible name says what it is and whose
 * ("Account: ana"): it is text of the button, not an `aria-label`, and the
 * initials and the visible copy of the name are hidden from it, so what is
 * read out and what is seen cannot disagree. Where the bar shows the initials
 * alone, and where the name is cut short, a tooltip says the same. It is the same element before
 * and after the menu code loads, so nothing moves. While the menu is loading
 * or a choice made in it is being stored, it is marked busy and looks it: what
 * is inside fades, the button and its focus outline do not.
 */
export function UserTrigger({
	name,
	className,
	...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
	/** The account that is signed in. */
	name: string;
}) {
	const t = useTranslations("nav");
	const account = t("account", { name });

	return (
		<Tooltip label={account} align="end">
			<Button
				variant="ghost"
				data-user-menu=""
				className={cn(
					"max-w-56 gap-2 px-1 aria-expanded:bg-accent aria-expanded:text-accent-foreground aria-busy:cursor-progress aria-busy:*:opacity-70 md:pe-2 pointer-coarse:px-2.5",
					className,
				)}
				{...props}
			>
				<Avatar size="sm" aria-hidden="true">
					<AvatarFallback>{initials(name)}</AvatarFallback>
				</Avatar>
				<span className="sr-only">{account}</span>
				<span
					aria-hidden="true"
					className="hidden min-w-0 truncate md:inline"
				>
					{name}
				</span>
			</Button>
		</Tooltip>
	);
}
