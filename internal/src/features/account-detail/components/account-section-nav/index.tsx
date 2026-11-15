import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	ACCOUNT_SECTIONS,
	type AccountSection,
	accountSectionHref,
} from "@/features/account-detail/schemas/account-section";

/**
 * The sections of one account, as links: the choice lives in the address
 * (`?section=`), so it works with no script, can be bookmarked and the server
 * reads it. The current one is a pill of the secondary surface, in bold, and
 * says so to a screen reader; the others have no fill until the pointer is on
 * them. No line marks it: the panel draws none.
 *
 * They are links and not tabs: the stock tab writes an animation duration in a
 * `style` attribute, which the panel's policy refuses, and a link does not
 * have to pretend to be a tab in the keyboard.
 *
 * Its words come in as props: it is drawn on the server, in the page and in
 * the loading state alike, and reads no catalog of its own.
 */
export function AccountSectionNav({
	base,
	section,
	label,
	names,
}: {
	/** The account page's own path. */
	base: Route;
	/** The section on screen. */
	section: AccountSection;
	/** What the navigation is, for a screen reader. */
	label: string;
	/** The words of each link. */
	names: Readonly<Record<AccountSection, string>>;
}) {
	return (
		<nav aria-label={label}>
			<ul className="flex flex-wrap gap-1">
				{ACCOUNT_SECTIONS.map((option) => (
					<li key={option}>
						<Button
							asChild
							variant={option === section ? "secondary" : "ghost"}
							className={
								option === section ? "font-semibold" : undefined
							}
						>
							<Link
								href={accountSectionHref(base, option)}
								aria-current={
									option === section ? "page" : undefined
								}
							>
								{names[option]}
							</Link>
						</Button>
					</li>
				))}
			</ul>
		</nav>
	);
}
