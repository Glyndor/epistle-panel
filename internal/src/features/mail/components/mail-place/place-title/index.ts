import "server-only";

import { getTranslations } from "next-intl/server";

import { getBrand } from "@/features/branding/queries/brand";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import { safeLine } from "@/features/mail/sanitize/safe-text";

/** Longest folder name put in a page title. */
const TITLE_TEXT = 80;

/**
 * The title of a folder's page: the folder and the panel's name. A folder the
 * account has by role is named in the reader's language; any other by the last
 * part of its own name (`Work/Q4` is "Q4"), cleaned like any text the account
 * wrote.
 */
export async function placeTitle(place: PlaceRef): Promise<string> {
	const brand = getBrand().name;
	if ("role" in place) {
		const t = await getTranslations("mail");
		return `${t(`role_${place.role}`)} · ${brand}`;
	}
	const last = place.box.split("/").at(-1) ?? "";
	const name = safeLine(last, TITLE_TEXT) || safeLine(place.box, TITLE_TEXT);
	return name === "" ? brand : `${name} · ${brand}`;
}
