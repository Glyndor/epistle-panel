"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { removeQueueEntry } from "@/lib/api/client";

export type RemoveState = { ok: boolean } | null;

const idSchema = z.uuid();

/**
 * Server action: drop one entry from the outbound spool. Returns a status so
 * the caller can surface success/failure; only a successful delete revalidates.
 */
export async function removeEntry(
	_previous: RemoveState,
	formData: FormData,
): Promise<RemoveState> {
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
