"use client";

import { ListFilterIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
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
 * ticks of a group, and the order as the one of another group. It is the same
 * menu the tables of the administration use, and it says how many of them are
 * on.
 *
 * What it sets is in the address: a tick is a condition of its own, and the
 * address is what the list reads. The list is drawn again with what the
 * address says.
 */
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
	const [main, setMain] = useState<HTMLElement | null>(null);
	const active = QUICK_FILTERS.filter((name) => conditions[name]).length;

	const go = (next: ListConditions) => {
		router.push(mailHref({ box, role, conditions: next }));
	};

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) {
					setMain(document.getElementById("main-content"));
				}
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">
					<ListFilterIcon aria-hidden="true" />
					{t("filters")}
					{active > 0 ? (
						<>
							<Badge variant="default" aria-hidden="true">
								{active}
							</Badge>
							<span className="sr-only">
								{t("filtersActive", { count: active })}
							</span>
						</>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" container={main}>
				<DropdownMenuGroup aria-labelledby={`${id}-filters`}>
					<DropdownMenuLabel id={`${id}-filters`}>
						{t("filtersLabel")}
					</DropdownMenuLabel>
					{FILTERS.map((filter) => (
						<DropdownMenuCheckboxItem
							key={filter.name}
							checked={conditions[filter.name]}
							onCheckedChange={() =>
								go({
									...conditions,
									[filter.name]: !conditions[filter.name],
								})
							}
							onSelect={(event) => event.preventDefault()}
						>
							{t(filter.label)}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
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
								onSelect={(event) => event.preventDefault()}
							>
								{t(order.label)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={active === 0}
					onSelect={() =>
						go({
							...conditions,
							unread: false,
							starred: false,
							important: false,
							attachment: false,
						})
					}
				>
					{t("showAll")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
