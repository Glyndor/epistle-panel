"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE } from "@/lib/auth/session";

/** Clear the session cookie and return to the login page. */
export async function logout(): Promise<void> {
	const store = await cookies();
	store.delete(SESSION_COOKIE);
	redirect("/login");
}
