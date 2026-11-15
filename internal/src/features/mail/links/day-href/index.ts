import type { Route } from "next";

import {
	EMPTY_CONDITIONS,
	isConditionDay,
} from "@/features/mail/schemas/list-conditions-model";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { folderAddress } from "../folder-address";

/**
 * The address of the messages of one day in the folder the person is in: the
 * folder's path with the `after` and `before` conditions of the list both
 * set to the day, which keeps the messages of that day (both ends are
 * included) and nothing else narrows it. `day` is `YYYY-MM-DD`; with `null`
 * the folder's path alone, which is what taking the day off leaves.
 *
 * The day is a day of the calendar the person reads, in their time zone. The
 * list keeps the messages received on that date in Greenwich, which is how
 * the conditions have always been counted (`queries/match-conditions`), so a
 * message that arrived close to midnight in a far zone can show under the
 * neighbouring day.
 *
 * @throws when `day` is not a day of the calendar: a link is never built from
 * a text the list would refuse.
 */
export function dayHref(
	day: string | null,
	activeId: string | null,
	boxes: readonly Pick<MailboxView, "id" | "role">[] | undefined,
): Route {
	if (day === null) {
		return folderAddress(activeId, boxes, EMPTY_CONDITIONS);
	}
	if (!isConditionDay(day)) {
		throw new RangeError("not a day of the calendar");
	}
	return folderAddress(activeId, boxes, {
		...EMPTY_CONDITIONS,
		after: day,
		before: day,
	});
}
