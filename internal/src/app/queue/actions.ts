"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { removeQueueEntry } from "@/lib/api/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export type RemoveState = { ok: boolean } | null;

const idSchema = z.uuid();

/**
 * Server action: drop one entry from the outbound spool. Returns a status so
 * the caller can surface success/failure; only a successful delete revalidates.
 * The session is checked here as well as in the proxy: a server action is a
 * public POST endpoint, so it cannot rely on the route gate in front of it.
 */
export async function removeEntry(
	_previous: RemoveState,
	formData: FormData,
): Promise<RemoveState> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	if (!session) {
		return { ok: false };
	}
	const id = idSchema.safeParse(formData.get("id"));
	if (!id.success) {
		return { ok: false };
	}
	try {
		await removeQueueEntry(id.data);
	} catch (error) {
		console.error("queue remove failed:", error);
		return { ok: false };
	}
	revalidatePath("/queue");
	return { ok: true };
}
