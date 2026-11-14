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
 * Give each run a key that does not change while the run is there: its date
 * group, and which run of that group it is when a message out of order makes
 * the group come back. A key taken from the run's first message changed when
 * that message left, the whole run was drawn again, and a control in it that
 * had the focus was replaced: the focus fell to the page.
 */
function keyed<T extends { readonly group: DateGroup }>(
	runs: readonly T[],
): Array<T & { readonly key: string }> {
	const seen = new Map<string, number>();
	return runs.map((run) => {
		const name = dateGroupKey(run.group);
		const nth = seen.get(name) ?? 0;
		seen.set(name, nth + 1);
		return { ...run, key: `${name}#${nth}` };
	});
}

/**
 * The messages of a page under the date they arrived on: today, yesterday,
 * the last few days, then one heading a month. The order is the server's and
 * is never changed: a message out of order starts a new run under its own
 * heading. `today` is the UTC day the server read the list on, so the server
 * render and the browser group alike.
 *
 * The headings are one level under the list's own, which `MessageList`
 * draws around every state of the list.
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
	return (
		<div className="flex flex-col gap-3 px-2 pb-2">
			{keyed(groupByDate(items, today)).map(({ key, group, rows }) => (
				<Group
					key={key}
					group={group}
					rows={rows}
					selectedId={selectedId}
					view={view}
				/>
			))}
		</div>
	);
}
