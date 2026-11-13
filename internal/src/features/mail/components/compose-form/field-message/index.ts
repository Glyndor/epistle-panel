import {
	type ComposeSizeMessage,
	isComposeSizeMessage,
} from "@/features/mail/schemas/compose-form";

/**
 * The words under a composer field. The schema's messages are keys and go
 * through `translate`; a recipient field's own messages (the pieces that are
 * not addresses, the missing recipient) are sentences already and pass as they
 * are.
 */
export function fieldMessage(
	message: string,
	translate: (key: ComposeSizeMessage) => string,
): string {
	return isComposeSizeMessage(message) ? translate(message) : message;
}
