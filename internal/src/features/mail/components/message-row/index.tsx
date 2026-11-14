import { ForwardIcon, PaperclipIcon, ReplyIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LabelChips } from "@/features/mail/components/label-chips";
import { RowActions } from "@/features/mail/components/row-actions";
import {
	formatRowDate,
	type RowDatePart,
} from "@/features/mail/format/row-date";
import { type ListAddress, mailHref } from "@/features/mail/links/mail-href";
import type { MessageSummary } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";
import { initials } from "@/lib/initials";

/**
 * The row's box and its height, which no state changes: 72 px for the
 * comfortable list (two lines and the preview) and 40 px for the compact one
 * (44 px on a coarse pointer). The density comes from the pane
 * (`group/list`). The row is the container its own parts ask about their
 * room (`@container/row`). The row under the pointer or with the focus is
 * raised one step over its neighbours; it stays under a date heading, which
 * is higher.
 */
const ROW =
	"group/row @container/row relative h-18 rounded-xl hover:z-1 hover:bg-muted focus-within:z-1 active:bg-accent group-data-[density=compact]/list:h-10 pointer-coarse:group-data-[density=compact]/list:h-11";

/**
 * The open message: the accent surface and a mark at the start edge, which is
 * the right one in a right-to-left page. The mark stands inside the focus
 * ring, which is drawn on the row's two outer pixels, so the ring keeps its
 * four sides. Under the pointer and pressed the surface steps toward the
 * pane's own, which leaves every text on it at least as readable as at rest.
 */
const OPEN =
	"bg-accent before:pointer-events-none before:absolute before:inset-y-2 before:start-0.5 before:w-1 before:rounded-full before:bg-primary hover:bg-accent/50 active:bg-accent/25";

/**
 * The link fills the row. Comfortable: the initials, then three lines beside
 * them; the end of the first line is left free for the two buttons. Compact:
 * two short lines, the sender and the date over the subject, in the same
 * 40 px; from 42rem of row, one line. The buttons of a compact row and of a
 * coarse pointer are as tall as the row, so the whole link stops short of
 * them.
 */
const LINK =
	"grid h-full grid-cols-[auto_minmax(0,1fr)_auto] content-center items-center rounded-xl ps-5 pe-3 text-sm outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2 group-data-[density=compact]/list:pe-15 group-data-[density=compact]/list:text-xs group-data-[density=compact]/list:@2xl/row:grid-cols-[auto_8rem_minmax(0,1fr)_auto] pointer-coarse:pe-23 pointer-coarse:group-data-[density=compact]/list:pe-23";

/** The initials. They leave a row too narrow to hold them beside the subject's least width: under 20rem, and under 24rem when compact. */
const AVATAR =
	"col-start-1 row-span-3 row-start-1 me-3 mt-1 hidden self-start @xs/row:flex group-data-[density=compact]/list:me-2 group-data-[density=compact]/list:mt-0 group-data-[density=compact]/list:row-span-2 group-data-[density=compact]/list:hidden group-data-[density=compact]/list:size-6 group-data-[density=compact]/list:self-center group-data-[density=compact]/list:@sm/row:flex group-data-[density=compact]/list:@2xl/row:row-span-1";

/** A dot in the row's own margin, before the sender and before the initials that stand for the sender: no row moves when it comes or goes. */
const UNREAD_DOT =
	"absolute start-2 top-3.5 size-2 rounded-full bg-primary forced-color-adjust-none group-data-[density=compact]/list:top-1/2 group-data-[density=compact]/list:-translate-y-1/2";

const SENDER =
	"col-start-2 row-start-1 flex h-5 min-w-0 items-center gap-1.5 group-data-[density=compact]/list:h-4";

/** The subject's line. One line when compact and wide: it moves beside the sender. */
const SUBJECT =
	"col-span-2 col-start-2 row-start-2 flex h-5 min-w-0 items-center gap-1.5 group-data-[density=compact]/list:h-4 group-data-[density=compact]/list:@2xl/row:col-span-1 group-data-[density=compact]/list:@2xl/row:col-start-3 group-data-[density=compact]/list:@2xl/row:row-start-1 group-data-[density=compact]/list:@2xl/row:ms-2";

/**
 * The subject's words. They come first: on its line everything else gives way
 * before the subject goes under its least width, which is 6rem, and 10rem
 * with a fine pointer from 24rem of row. Compact, where the line is the
 * row's whole width: 5rem, 6rem from 20rem, 10rem from 24rem and 12rem there
 * with a fine pointer; 8rem on one line. Each was added up against the
 * narrowest line of its case before it was measured.
 */
const SUBJECT_TEXT =
	"min-w-24 flex-1 truncate pointer-fine:@sm/row:min-w-40 group-data-[density=compact]/list:min-w-20 group-data-[density=compact]/list:@xs/row:min-w-24 group-data-[density=compact]/list:@sm/row:min-w-40 pointer-fine:group-data-[density=compact]/list:@sm/row:min-w-48 group-data-[density=compact]/list:@2xl/row:min-w-32 pointer-fine:group-data-[density=compact]/list:@2xl/row:min-w-32 group-data-[open=true]/row:group-hover/row:underline";

const PREVIEW =
	"col-span-2 col-start-2 row-start-3 h-4 truncate text-muted-foreground text-xs leading-4 group-data-[density=compact]/list:hidden";

/** The clip and the date. They keep their own width: the sender beside them gives way first. */
const META =
	"col-start-3 row-start-1 ms-2 me-12 flex h-5 shrink-0 items-center gap-1.5 text-muted-foreground text-xs group-data-[density=compact]/list:me-0 group-data-[density=compact]/list:h-4 group-data-[density=compact]/list:@2xl/row:col-start-4 pointer-coarse:me-0";

/**
 * One message of the list. The row is a list item that holds a link to the
 * message and, after it, the buttons for its two marks: siblings, because a
 * button inside a link is not valid and not reachable.
 *
 * Every state has a sign that is not a colour, and none changes the row's
 * height: an unread message is heavier and has a dot before its sender; a
 * starred or important one shows its mark filled beside the date; an answered
 * or forwarded one has the icon of it before the subject; a draft says so
 * before the name; an attachment is a clip beside the date; labels are chips
 * or a count after the subject; the open message is on the accent surface
 * with a mark at its start edge. All of it is said once in words to assistive
 * technology, where the icons are silent.
 *
 * Every text is text from the message, already cleaned on the server and
 * wrapped in `<bdi>` here, so a right-to-left sender cannot reorder what is
 * beside it.
 */
export function MessageRow({
	message,
	selected,
	view,
	datePart,
}: {
	message: MessageSummary;
	selected: boolean;
	/** What the row prints of its date: the heading it stands under says the rest. */
	datePart: RowDatePart;
	/** The list's own parameters, so the link keeps the folder, the filter and the page. */
	view: ListAddress;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	const sender = message.from?.name ?? message.from?.email ?? t("noSender");
	const states: ReactNode[] = [
		message.unread ? t("stateUnread") : null,
		message.flagged ? t("stateFlagged") : null,
		message.important ? t("stateImportant") : null,
		message.answered ? t("stateAnswered") : null,
		message.forwarded ? t("stateForwarded") : null,
		message.draft ? t("stateDraft") : null,
		message.hasAttachment ? t("hasAttachment") : null,
		// A label's name is text from the message: each in its own `<bdi>`.
		message.labels.length > 0
			? t.rich("stateLabels", {
					names: () =>
						format.list(
							message.labels.map((label) => (
								<bdi key={label.keyword}>{label.name}</bdi>
							)),
							{ type: "conjunction" },
						),
				})
			: null,
	].filter((state) => state !== null);

	return (
		<li
			data-slot="message-row"
			data-unread={message.unread}
			data-open={selected}
			className={cn(ROW, selected && OPEN)}
		>
			<Link
				href={mailHref({ ...view, msg: message.id })}
				aria-current={selected ? "true" : undefined}
				data-message-id={message.id}
				scroll={false}
				className={LINK}
			>
				{states.length > 0 ? (
					<span className="sr-only">
						{states.map((state, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of this render
							<Fragment key={index}>
								{index === 0 ? null : ", "}
								{state}
							</Fragment>
						))}
						.
					</span>
				) : null}
				{message.unread ? (
					<span data-slot="unread-dot" className={UNREAD_DOT} />
				) : null}
				<Avatar aria-hidden="true" className={AVATAR}>
					<AvatarFallback className="bg-foreground/10 text-foreground text-xs">
						<bdi>{initials(sender)}</bdi>
					</AvatarFallback>
				</Avatar>
				<span className={SENDER}>
					{message.draft ? (
						<Badge
							variant="muted"
							aria-hidden="true"
							className="group-data-[density=compact]/list:py-0"
						>
							{t("stateDraft")}
						</Badge>
					) : null}
					<bdi
						className={cn(
							"min-w-12 truncate",
							message.unread
								? "font-semibold"
								: "text-muted-foreground",
						)}
					>
						{sender}
					</bdi>
				</span>
				<span className={SUBJECT}>
					{message.answered ? (
						<ReplyIcon
							aria-hidden="true"
							data-slot="answered-icon"
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
					) : null}
					{message.forwarded ? (
						<ForwardIcon
							aria-hidden="true"
							data-slot="forwarded-icon"
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
					) : null}
					<bdi
						className={cn(
							SUBJECT_TEXT,
							message.unread && "font-medium",
						)}
					>
						{message.subject === ""
							? t("noSubject")
							: message.subject}
					</bdi>
					<LabelChips labels={message.labels} />
				</span>
				<bdi className={PREVIEW}>{message.preview}</bdi>
				<span className={META}>
					{message.hasAttachment ? (
						<PaperclipIcon
							aria-hidden="true"
							data-slot="attachment-icon"
							className="size-3.5 shrink-0"
						/>
					) : null}
					<time
						dateTime={message.receivedAt}
						data-date-part={datePart}
					>
						{formatRowDate(format, message.receivedAt, datePart)}
					</time>
				</span>
			</Link>
			<RowActions
				id={message.id}
				box={view.box}
				flagged={message.flagged}
				important={message.important}
			/>
		</li>
	);
}
