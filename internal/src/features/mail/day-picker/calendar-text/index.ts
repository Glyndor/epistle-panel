import type { Formatters } from "react-day-picker";

/**
 * How the calendar writes its dates, as `Intl` writes them in the language of
 * the page: the month and year over the grid, the first letter of each
 * weekday over its column, and a day in full for a screen reader. The library
 * writes them with the date-fns locale it is given, which is another list of
 * names than the one the rest of the panel prints dates with, and a bundle of
 * its own for each language.
 *
 * A date reaching these functions is the calendar's, held at noon on the wall
 * of whoever draws it, so they are written in that same zone and the numbers
 * on it are the day's own.
 */
export interface CalendarText {
	/** The month and year a grid is for: "November 2026". */
	readonly caption: (date: Date) => string;
	/** The weekday above a column, as short as the language makes it. */
	readonly weekdayShort: (date: Date) => string;
	/** The weekday above a column, in full, for the column's name. */
	readonly weekdayLong: (date: Date) => string;
	/** A day in full: "Sunday, November 15, 2026". */
	readonly dayLong: (date: Date) => string;
}

const cache = new Map<string, CalendarText>();

/** The writers for one language; made once, since each `Intl` formatter is costly to build. */
export function calendarText(locale: string): CalendarText {
	const known = cache.get(locale);
	if (known !== undefined) {
		return known;
	}
	const writer = (options: Intl.DateTimeFormatOptions) => {
		const format = new Intl.DateTimeFormat(locale, options);
		return (date: Date) => format.format(date);
	};
	const made: CalendarText = {
		caption: writer({ month: "long", year: "numeric" }),
		weekdayShort: writer({ weekday: "narrow" }),
		weekdayLong: writer({ weekday: "long" }),
		dayLong: writer({
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		}),
	};
	cache.set(locale, made);
	return made;
}

/** The library's formatters, from the writers of a language. */
export function calendarFormatters(text: CalendarText): Partial<Formatters> {
	return {
		formatCaption: (month) => text.caption(month),
		formatWeekdayName: (weekday) => text.weekdayShort(weekday),
	};
}
