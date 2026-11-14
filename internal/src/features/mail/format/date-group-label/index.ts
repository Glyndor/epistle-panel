import type { DateGroup } from "@/features/mail/format/date-group";

/** The message keys of the groups that are not a month. */
export type DateGroupMessage =
	| "groupToday"
	| "groupYesterday"
	| "groupRecent"
	| "groupUnknown";

/** What this asks of a date formatter. next-intl's `useFormatter()` satisfies it, and so does a test stand-in. */
interface MonthFormatter {
	dateTime(
		value: Date,
		options: { month: "long"; year: "numeric"; timeZone: "UTC" },
	): string;
}

/**
 * The words of a date group's heading in the reader's language: today,
 * yesterday, the last few days, or the month and the year of an older
 * message. The month is printed in UTC because the groups are days of UTC
 * (`date-group`): in the browser's own zone a message of the first hours of a
 * month would stand under the name of the month before, west of Greenwich.
 */
export function dateGroupLabel(
	group: DateGroup,
	t: (key: DateGroupMessage) => string,
	format: MonthFormatter,
): string {
	switch (group.kind) {
		case "today":
			return t("groupToday");
		case "yesterday":
			return t("groupYesterday");
		case "week":
			return t("groupRecent");
		case "month":
			return format.dateTime(
				new Date(Date.UTC(group.year, group.month - 1, 1)),
				{ month: "long", year: "numeric", timeZone: "UTC" },
			);
		default:
			return t("groupUnknown");
	}
}
