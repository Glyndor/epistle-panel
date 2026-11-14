/**
 * The cookie that keeps the desktop sidebar open or collapsed, for both areas
 * of the panel. A layout reads it on the server so the first paint is already
 * the one the person left; the sidebar's provider writes it in the browser.
 *
 * This module has no `"use client"` on purpose. A value exported from a client
 * module is, on the server, a reference to that module and not the value: the
 * layouts used to import the name from the provider, asked the request for a
 * cookie named by a reference, and never found it.
 */

/** Name of the cookie. */
export const SIDEBAR_COOKIE = "sidebar_state";

/** A year, in seconds. */
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Whether the sidebar starts open, from the cookie's value as the request
 * carries it: collapsed only when the value is exactly `false`, so no cookie
 * and a value nobody wrote both read as open.
 */
export function sidebarStartsOpen(value: string | undefined): boolean {
	return value !== "false";
}

/**
 * The cookie as the browser stores it. Its path is the whole panel: the choice
 * made in the mail area holds in the administration and the reverse.
 */
export function sidebarCookie(open: boolean): string {
	return `${SIDEBAR_COOKIE}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
}
