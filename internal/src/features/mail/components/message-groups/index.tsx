import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";

import { MessageRow } from "@/features/mail/components/message-row";
import {
	type DateGroup,
	dateGroupKey,
	groupByDate,
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
function Group({
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
				className="sticky top-0 z-10 h-8 truncate bg-surface px-3 font-medium text-muted-foreground text-xs leading-8 first-letter:uppercase"
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

/**
 * The messages of a page under the date they arrived on: today, yesterday,
 * the last few days, then one heading a month. The order is the server's and
 * is never changed: a message out of order starts a new run under its own
 * heading. `today` is the UTC day the server read the list on, so the server
 * render and the browser group alike.
 *
 * The headings are one level under the list's own, which this draws for
 * assistive technology only: the pane is already named for the eye by the
 * folder it shows.
 */
export function MessageGroups({
	items,
	today,
	selectedId,
	view,
}: {
	items: readonly MessageSummary[];
	today: string;
	selectedId: string | undefined;
	view: ListAddress;
}) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-3 px-2 pb-2">
			<h2 className="sr-only">{t("listLabel")}</h2>
			{groupByDate(items, today).map(({ group, rows }) => (
				<Group
					// A run is told from the others by its first message: a
					// group can come back after a message out of order.
					key={rows[0]?.id ?? dateGroupKey(group)}
					group={group}
					rows={rows}
					selectedId={selectedId}
					view={view}
				/>
			))}
		</div>
	);
}
