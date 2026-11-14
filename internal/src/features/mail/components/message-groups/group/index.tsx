import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";

import { MessageRow } from "@/features/mail/components/message-row";
import {
	type DateGroup,
	dateGroupKey,
} from "@/features/mail/format/date-group";
import { dateGroupLabel } from "@/features/mail/format/date-group-label";
import { rowDatePart } from "@/features/mail/format/row-date";
import type { ListAddress } from "@/features/mail/links/mail-href";
import type { MessageSummary } from "@/features/mail/schemas/mail-view";

/**
 * One run of messages of the same date group: a heading and the list it
 * names. The heading stays at the top of the pane while its own run scrolls
 * under it, on the pane's surface and with no line; the pane's scroll padding
 * (`scroll-pt-8`, the heading's height) keeps a row the keyboard reaches from
 * hiding behind it.
 */
export function Group({
	group,
	rows,
	selectedId,
	view,
}: {
	group: DateGroup;
	rows: readonly MessageSummary[];
	selectedId: string | undefined;
	view: ListAddress;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	const heading = useId();
	const datePart = rowDatePart(group.kind);

	return (
		<div data-slot="message-group" data-group={dateGroupKey(group)}>
			<h3
				id={heading}
				className="sticky top-0 z-10 h-8 truncate bg-surface px-3 font-medium text-muted-foreground text-xs leading-8 select-none first-letter:uppercase"
			>
				{dateGroupLabel(group, t, format)}
			</h3>
			<ul aria-labelledby={heading} className="flex flex-col gap-1">
				{rows.map((message) => (
					<MessageRow
						key={message.id}
						message={message}
						selected={message.id === selectedId}
						view={view}
						datePart={datePart}
					/>
				))}
			</ul>
		</div>
	);
}
