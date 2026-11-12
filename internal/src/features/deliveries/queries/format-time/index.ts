/**
 * An epoch second as `YYYY-MM-DD HH:MM:SS` in UTC. It does not use the viewer's
 * time zone, so the server render and the browser agree and a record reads the
 * same wherever it is looked at. A value that is not a date prints as `-`.
 */
export function formatUtcTime(epochSeconds: number): string {
	const date = new Date(epochSeconds * 1000);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return date.toISOString().slice(0, 19).replace("T", " ");
}
