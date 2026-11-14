"use client";

import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getMessageListAction } from "@/features/mail/actions/get-message-list";
import { mailHref } from "@/features/mail/links/mail-href";
import { messageListQueryOptions } from "@/features/mail/queries/mail-query-options";
import { stripBidi } from "@/features/mail/sanitize/safe-text";
import {
	activeConditions,
	CONDITION_LABELS,
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
									aria-label={t("conditionRemove", {
										name: said,
									})}
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
