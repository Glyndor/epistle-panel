/** A day of the week as the calendar counts them: 0 is Sunday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface WeekInfo {
	readonly firstDay: number;
}

type LocaleWithWeek = Intl.Locale & {
	getWeekInfo?: () => WeekInfo;
	weekInfo?: WeekInfo;
};

/**
 * The first day of the week in a language, the one its country's calendar
 * starts on: Sunday for English and Portuguese, Monday for the other four
 * (the likely region is added to a bare language, so `en` is `en-US`).
 *
 * It is read on the server and handed to the browser: the browser's own
 * answer depends on its engine (Firefox gave none for years) and on its
 * settings, and a first paint that a script then moves is a first paint that
 * lied. A language the runtime knows nothing about starts on Monday.
 */
export function firstDayOfWeek(locale: string): WeekDay {
	try {
		const likely: LocaleWithWeek = new Intl.Locale(locale).maximize();
		const info = likely.getWeekInfo?.() ?? likely.weekInfo;
		if (info !== undefined) {
			// Intl counts 1 to 7 from Monday; the calendar counts 0 to 6 from Sunday.
			return (info.firstDay % 7) as WeekDay;
		}
	} catch {
		// A tag that is not one falls through to the default.
	}
	return 1;
}
