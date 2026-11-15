"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { NavSection } from "@/components/layout/nav-section";
import { Calendar } from "@/components/ui/calendar";
import { useSidebar } from "@/components/ui/sidebar/context";
import { useLoadedMail } from "@/features/mail/components/labels-nav/use-loaded-mail";
import {
	calendarFormatters,
	calendarText,
} from "@/features/mail/day-picker/calendar-text";
import {
	dateToDay,
	dayToDate,
	selectedDay,
} from "@/features/mail/day-picker/days";
import { useToday } from "@/features/mail/day-picker/use-today";
import type { WeekDay } from "@/features/mail/day-picker/week-start";
import { activeFolder } from "@/features/mail/links/active-folder";
import { dayHref } from "@/features/mail/links/day-href";
import type { TimeZone } from "@/features/time-zone/config/zones";

/** The first and the last day a condition names: the calendar does not go past them. */
const FIRST_DAY = new Date(1970, 0, 1, 12);
const LAST_DAY = new Date(9999, 11, 31, 12);

/**
 * The calendar of the mail area's sidebar, under a heading that opens and
 * closes it: a month of days, and a press on one lists the messages of the
 * folder the person is in that arrived on it (`after` and `before` of the
 * list's search, both that day). The day pressed shows as chosen while the
 * address names exactly it, and pressing it again takes it off.
 *
 * It is drawn from what the server hands it, so the page the server sends is
 * the one the browser keeps: today, the zone the person reads dates in and the
 * day the week starts on come as props, and the month shown starts as the
 * chosen day's, or today's. Today is read again from the browser's clock when
 * the window comes back (`useToday`). The rail collapsed to icons has no room
 * for a month, so there the whole group is out of the page.
 *
 * The day is a day of the calendar in the person's zone. The list counts the
 * messages of that date in Greenwich (see `dayHref`), which is stated in the
 * group's hint rather than hidden.
 */
export function DayPickerNav({
	today: serverToday,
	timeZone,
	weekStartsOn,
}: {
	/** Today in the person's zone, `YYYY-MM-DD`, as the server read it. */
	today: string;
	/** The zone the person reads dates in. */
	timeZone: TimeZone;
	/** The day the week starts on in the person's language, 0 for Sunday. */
	weekStartsOn: WeekDay;
}) {
	const t = useTranslations("mail");
	const locale = useLocale();
	const hint = useId();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const { boxes } = useLoadedMail();
	const { setOpenMobile } = useSidebar();
	const today = useToday(serverToday, timeZone);
	const chosen = selectedDay({
		after: params.get("after"),
		before: params.get("before"),
	});
	const [month, setMonth] = useState(
		() => dayToDate(chosen ?? serverToday) ?? new Date(NaN),
	);
	const todayDate = dayToDate(today);
	const text = useMemo(() => calendarText(locale), [locale]);
	const formatters = useMemo(() => calendarFormatters(text), [text]);
	const activeId = activeFolder(pathname, boxes ?? []);

	return (
		<div
			data-slot="day-picker-nav"
			data-rail="hidden"
			className="group-data-[collapsible=icon]:hidden"
		>
			<NavSection id="calendar" label={t("calendarNav")}>
				<p id={hint} className="sr-only">
					{t("calendarHint")}
				</p>
				{/* biome-ignore lint/a11y/useSemanticElements: a fieldset is the form's group; this one names and describes a calendar, which is no form. */}
				<div
					role="group"
					aria-label={t("calendarNav")}
					aria-describedby={hint}
				>
					<Calendar
						mode="single"
						lang={locale}
						month={month}
						onMonthChange={setMonth}
						{...(todayDate === undefined
							? {}
							: { today: todayDate })}
						selected={
							chosen === null ? undefined : dayToDate(chosen)
						}
						onSelect={(next) => {
							// On a narrow screen the navigation is a sheet over the
							// list: it closes once a day is chosen, like a folder.
							setOpenMobile(false);
							router.push(
								dayHref(
									next === undefined ? null : dateToDay(next),
									activeId,
									boxes,
								),
							);
						}}
						weekStartsOn={weekStartsOn}
						startMonth={FIRST_DAY}
						endMonth={LAST_DAY}
						showOutsideDays={false}
						fixedWeeks
						formatters={formatters}
						labels={{
							labelNav: () => t("calendarNav"),
							labelPrevious: () => t("calendarPrevious"),
							labelNext: () => t("calendarNext"),
							labelGrid: (date) => text.caption(date),
							labelWeekday: (date) => text.weekdayLong(date),
							labelDayButton: (date, modifiers) =>
								t("calendarDay", {
									date: text.dayLong(date),
									state: modifiers["today"]
										? modifiers["selected"]
											? "todaySelected"
											: "today"
										: modifiers["selected"]
											? "selected"
											: "plain",
								}),
						}}
					/>
				</div>
			</NavSection>
		</div>
	);
}
