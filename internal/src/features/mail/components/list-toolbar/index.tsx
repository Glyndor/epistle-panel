import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/features/mail/components/density-toggle";
import { FiltersMenu } from "@/features/mail/components/list-toolbar/filters-menu";
import type { ListDensity } from "@/features/mail/config/list-density";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	hasConditions,
	type ListConditions,
} from "@/features/mail/schemas/list-conditions-model";
import { SCAN_LIMIT } from "@/features/mail/schemas/mail-input";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";

/**
 * What the list is narrowed by, over the results: the filters of the folder,
 * the order, and the note that says what the search reads. The search itself
 * is in the header of the bar (`mail-search`), where there is room for it; the
 * filters are here, beside the list they narrow.
 */
export function ListToolbar({
	box,
	folderRole: role,
	conditions,
	density,
}: {
	box: string;
	/** The folder's role, when its path is the role's. Not named `role`, which on an element is ARIA's. */
	folderRole: MailboxRole | null;
	/** What narrows the list, as the address said it. */
	conditions: ListConditions;
	/** The density the server read from the cookie and painted on the pane. */
	density: ListDensity;
}) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center justify-end gap-2">
				<FiltersMenu box={box} role={role} conditions={conditions} />
				{conditions.q === "" ? null : (
					<Button asChild variant="ghost" size="sm">
						<Link
							href={mailHref({
								box,
								role,
								conditions: { ...conditions, q: "" },
							})}
						>
							{t("searchClear")}
						</Link>
					</Button>
				)}
				<DensityToggle density={density} />
			</div>
			{hasConditions(conditions) ? (
				<p className="text-muted-foreground text-xs">
					{t("searchNote", { count: SCAN_LIMIT })}
				</p>
			) : null}
		</div>
	);
}
