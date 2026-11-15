/** The zones the running process knows, plus the panel's own clock. */
const supportedZones = (): readonly string[] => {
	const list =
		typeof Intl.supportedValuesOf === "function"
			? Intl.supportedValuesOf("timeZone")
			: [];
	return Object.freeze(["UTC", ...list]);
};

/**
 * The time zones a person can choose, and the cookie that holds the choice.
 *
 * The list is the one the running process knows: `Intl.supportedValuesOf`
 * names every zone its `Intl` can print, and the panel believes nothing else.
 * A value is a choice when it is exactly one of those names: `Intl` would also
 * take an alias or an offset such as `GMT+5`, and the panel's list does not,
 * so a value is never believed for having been accepted by `Intl`.
 *
 * The list is built when the module loads, so it is the list of the process
 * that runs it: the server builds it in Node, the browser builds the same
 * list for itself. `UTC` is on it, whatever the `Intl` of the process says,
 * because it is the panel's own default and the one clock every process has.
 */
export const TIME_ZONES: readonly string[] = supportedZones();

/**
 * The name of a zone of {@link TIME_ZONES}. The list is built when the module
 * loads, so its names cannot be a union of words at the type level:
 * {@link isTimeZone} is what says a name is one of them.
 */
export type TimeZone = string;

/** The zone when the cookie is missing, holds anything else, or the operator set none. */
export const DEFAULT_TIME_ZONE: TimeZone = "UTC";

/** Name of the cookie that holds the chosen time zone. */
export const TIME_ZONE_COOKIE = "time-zone";

/** The cookie is sent under `/app`, so the mail area and the preferences page both see it. */
export const TIME_ZONE_COOKIE_PATH = "/app";

/** Whether a value is one of the {@link TIME_ZONES}, exactly. */
export function isTimeZone(value: unknown): value is TimeZone {
	return typeof value === "string" && TIME_ZONES.includes(value);
}

/** A stored value as a zone: anything that is not exactly a zone is `UTC`. */
export function parseTimeZone(value: unknown): TimeZone {
	return isTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

/**
 * The zone this process can print in: the one it was given, or `UTC` when this
 * process does not know it. The list is the list of the process, so a zone the
 * server knows and the browser does not falls back here instead of throwing
 * where a date is printed.
 */
export function resolveTimeZone(timeZone: TimeZone): TimeZone {
	return isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/** The zones of one region, as the select groups them. */
export interface TimeZoneGroup {
	/** The region the zones belong to, as the name of the zone spells it. Empty for a zone of no region. */
	readonly region: string;
	readonly zones: readonly string[];
}

/**
 * The zones by region, for the select: `UTC` first, then the regions in
 * alphabetical order, each with its zones in alphabetical order. The region is
 * the part of the name before the slash, which is how the IANA names are
 * written; it is shown as it is, the way the menu shows a language's own name.
 */
export const TIME_ZONE_GROUPS: readonly TimeZoneGroup[] = Object.freeze(
	groupZones(["UTC", ...TIME_ZONES.filter((zone) => zone !== "UTC")]),
);

function groupZones(zones: readonly string[]): TimeZoneGroup[] {
	const groups: Array<{ region: string; zones: string[] }> = [];
	for (const zone of zones) {
		const region = zone.includes("/") ? (zone.split("/")[0] ?? zone) : "";
		const last = groups.at(-1);
		if (last !== undefined && last.region === region) {
			last.zones.push(zone);
			continue;
		}
		groups.push({ region, zones: [zone] });
	}
	return groups;
}
