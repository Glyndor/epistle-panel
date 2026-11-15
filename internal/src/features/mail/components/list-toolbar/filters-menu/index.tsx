"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { FilterMenu } from "@/components/filter-menu";
import {
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	type ListConditions,
	type ListOrder,
	QUICK_FILTERS,
} from "@/features/mail/schemas/list-conditions-model";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";

/** The quick filters, each one a tick of the group. */
const FILTERS = [
	{ name: "unread", label: "filterUnread" },
	{ name: "starred", label: "filterFlagged" },
	{ name: "important", label: "filterImportant" },
	{ name: "attachment", label: "filterAttachments" },
] as const satisfies readonly {
	name: (typeof QUICK_FILTERS)[number];
	label: string;
}[];

/** The orders the list can be in. */
const ORDERS = [
	{ name: "newest", label: "orderNewest" },
	{ name: "oldest", label: "orderOldest" },
	{ name: "largest", label: "orderLargest" },
] as const satisfies readonly { name: ListOrder; label: string }[];

/**
 * The filters and the order of the list, in one menu: the quick filters as
 * ticks of a group, and the order as the one of another group. It is drawn
 * like the Filters menu of the tables of the administration, and it says how
 * many of them are on, but it is not that component: that one is bound to
 * the facets of a table and to the words of the tables, and it has no place
 * for the order, which is a choice of its own.
 *
 * What it sets is in the address: a tick is a condition of its own, and the
 * address is what the list reads. The list is drawn again with what the
 * address says.
 */
/** The presentation is now shared; the order and address changes stay here. */
export function FiltersMenu({
	box,
	role,
	conditions,
}: {
	/** The folder the list is read from. */
	box: string;
	/** The folder's role, when its path is the role's. */
	role: MailboxRole | null;
	/** What narrows the list, as the address said it. */
	conditions: ListConditions;
}) {
	const t = useTranslations("mail");
	const router = useRouter();
	const id = useId();
	const active = QUICK_FILTERS.filter((name) => conditions[name]).length;

	const go = (next: ListConditions) => {
		router.push(mailHref({ box, role, conditions: next }));
	};

	return (
		<FilterMenu
			label={t("filters")}
			activeLabel={t("filtersActive", { count: active })}
			clearLabel={t("showAll")}
			active={active}
			groups={[
				{
					id: "filters",
					label: t("filtersLabel"),
					options: FILTERS.map((filter) => ({
						value: filter.name,
						label: t(filter.label),
						checked: conditions[filter.name],
						onToggle: () =>
							go({
								...conditions,
								[filter.name]: !conditions[filter.name],
							}),
					})),
				},
			]}
			onClear={() =>
				go({
					...conditions,
					unread: false,
					starred: false,
					important: false,
					attachment: false,
				})
			}
		>
			<DropdownMenuSeparator />
			<DropdownMenuGroup aria-labelledby={`${id}-order`}>
				<DropdownMenuLabel id={`${id}-order`}>
					{t("order")}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={conditions.order}
					onValueChange={(value) =>
						go({ ...conditions, order: value as ListOrder })
					}
				>
					{ORDERS.map((order) => (
						<DropdownMenuRadioItem
							key={order.name}
							value={order.name}
						>
							{t(order.label)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuGroup>
		</FilterMenu>
	);
}
