"use client";

import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getMessageListAction } from "@/features/mail/actions/get-message-list";
import { SEARCH_FIELD_ID } from "@/features/mail/components/mail-search/search-field";
import { listMemory } from "@/features/mail/components/message-list/list-memory";
import { mailHref } from "@/features/mail/links/mail-href";
import { messageListQueryOptions } from "@/features/mail/queries/mail-query-options";
import { stripBidi } from "@/features/mail/sanitize/safe-text";
import {
	activeConditions,
	CONDITION_LABELS,
	CONDITION_NAMES,
	type ConditionName,
	EMPTY_CONDITIONS,
	type ListConditions,
	withoutCondition,
} from "@/features/mail/schemas/list-conditions-model";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
import { unwrap } from "@/lib/query/action-result";

const fetchList = async (input: Parameters<typeof getMessageListAction>[0]) =>
	unwrap(await getMessageListAction(input));

/** What a chip says of its condition: the field, and the value it holds. */
function chipValue(conditions: ListConditions, name: string): string | null {
	const value = conditions[name as keyof ListConditions];
	if (typeof value !== "string" || value === "") {
		return null;
	}
	const shown = stripBidi(value);
	return shown.length > 32 ? `${shown.slice(0, 32)}…` : shown;
}

/**
 * The chip that took the place of the one that was taken off: the one that
 * follows it, or the one before it when it was the last.
 */
function neighbour(
	active: readonly ConditionName[],
	taken: ConditionName,
): ConditionName | undefined {
	const index = CONDITION_NAMES.indexOf(taken);
	const after = active.find((name) => CONDITION_NAMES.indexOf(name) > index);
	if (after !== undefined) {
		return after;
	}
	return [...active]
		.reverse()
		.find((name) => CONDITION_NAMES.indexOf(name) < index);
}

/**
 * The conditions that narrow the list, over the results: each one a chip that
 * takes it off, a way to take them all off, and the number of messages that
 * matched.
 *
 * The chips are links: taking a condition off is a change of the address, and
 * the address is what the list reads. The count is the one of the list the
 * chips are over, read from the same query.
 */
export function ConditionChips({
	box,
	role,
	page,
	conditions,
}: {
	/** The folder the list is read from. */
	box: string;
	/** The folder's role, when its path is the role's. */
	role: MailboxRole | null;
	/** The page of the list on screen. */
	page: number;
	/** What narrows the list, as the address said it. */
	conditions: ListConditions;
}) {
	const t = useTranslations("mail");
	const { data } = useQuery(
		messageListQueryOptions({ box, page, conditions }, fetchList),
	);
	const active = activeConditions(conditions);

	// The chips are drawn again without the chip that was taken off, and the
	// focus goes with it: to the chip that took its place, or to the search
	// field when none is left. The chip that was taken off is remembered
	// while the change of the address is on its way.
	useEffect(() => {
		const taken = listMemory.chips;
		if (taken === null) {
			return;
		}
		const landed =
			taken === "all"
				? active.length === 0
				: !active.includes(taken as ConditionName);
		if (!landed) {
			return;
		}
		listMemory.chips = null;
		const next =
			taken === "all"
				? undefined
				: neighbour(active, taken as ConditionName);
		const target =
			next === undefined
				? document.getElementById(SEARCH_FIELD_ID)
				: document.querySelector(`[data-chip="${next}"]`);
		if (target instanceof HTMLElement) {
			target.focus();
		}
	}, [active]);

	if (active.length === 0) {
		return null;
	}

	return (
		<nav
			aria-label={t("conditionsLabel")}
			className="flex flex-wrap items-center gap-1 px-2"
		>
			{active.map((name) => {
				const label = t(CONDITION_LABELS[name]);
				const value = chipValue(conditions, name);
				const said = value === null ? label : `${label}: ${value}`;
				return (
					<Badge key={name} variant="muted">
						<span>{said}</span>
						<Tooltip label={t("conditionRemove", { name: said })}>
							<Button
								asChild
								variant="ghost"
								size="icon"
								className="size-4 rounded-full"
							>
								<Link
									href={mailHref({
										box,
										role,
										conditions: withoutCondition(
											conditions,
											name,
										),
									})}
									data-chip={name}
									aria-label={t("conditionRemove", {
										name: said,
									})}
									onClick={() => {
										listMemory.chips = name;
									}}
								>
									<XIcon aria-hidden="true" />
								</Link>
							</Button>
						</Tooltip>
					</Badge>
				);
			})}
			<Button asChild variant="ghost" size="sm">
				<Link
					href={mailHref({ box, role, conditions: EMPTY_CONDITIONS })}
					onClick={() => {
						listMemory.chips = "all";
					}}
				>
					{t("clearAll")}
				</Link>
			</Button>
			<span className="text-muted-foreground text-xs">
				{t("messageCount", { count: data?.total ?? 0 })}
			</span>
		</nav>
	);
}
