import { useFormatter, useTranslations } from "next-intl";
import { LabelChip } from "@/features/mail/components/label-chip";

import { formatReceivedAt } from "@/features/mail/format/received-at";
import type {
	AddressView,
	MessageDetail,
} from "@/features/mail/schemas/mail-view";

/** One address as text, the name first when there is one. Both parts are text from the message. */
function Addresses({ list }: { list: readonly AddressView[] }) {
	return (
		<>
			{list.map((address, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: the same address can be listed twice and the list never reorders
				<span key={`${address.email}-${index}`}>
					{index > 0 ? ", " : null}
					<bdi>
						{address.name === null
							? address.email
							: `${address.name} <${address.email}>`}
					</bdi>
				</span>
			))}
		</>
	);
}

/**
 * The subject and the headers a reader looks at first: from, to, cc, reply-to
 * the labels and the date. Every label is there as a chip with its whole
 * name: a row of the list may show only a count, and the names behind a count
 * are under the pointer alone. Each is shown as text and isolated with `<bdi>`, so what the
 * sender wrote cannot rearrange its neighbours. The heading takes focus when
 * the reader is the only pane in view, which `MessageReader` arranges.
 */
export function ReaderHeader({
	message,
	headingId,
}: {
	message: MessageDetail;
	headingId: string;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	const rows: Array<[string, readonly AddressView[]]> = [
		[t("from"), message.from],
		[t("to"), message.to],
		[t("cc"), message.cc],
		[t("replyTo"), message.replyTo],
	];

	return (
		<header className="flex flex-col gap-2 p-4">
			<h2
				id={headingId}
				tabIndex={-1}
				className="font-semibold text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<bdi>
					{message.subject === "" ? t("noSubject") : message.subject}
				</bdi>
			</h2>
			{message.labels.length === 0 ? null : (
				<ul
					aria-label={t("labelsTitle")}
					data-slot="reader-labels"
					className="flex flex-wrap gap-1"
				>
					{message.labels.map((label) => (
						<li key={label.keyword} className="flex min-w-0">
							<LabelChip
								label={label}
								className="h-6 max-w-full"
							/>
						</li>
					))}
				</ul>
			)}
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
				{rows
					.filter(([, list]) => list.length > 0)
					.map(([label, list]) => (
						<div key={label} className="contents">
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="break-words">
								<Addresses list={list} />
							</dd>
						</div>
					))}
				<dt className="text-muted-foreground">{t("date")}</dt>
				<dd>
					<time dateTime={message.receivedAt}>
						{formatReceivedAt(format, message.receivedAt)}
					</time>
				</dd>
			</dl>
		</header>
	);
}
