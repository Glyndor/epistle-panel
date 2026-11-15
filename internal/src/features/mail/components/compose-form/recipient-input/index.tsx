import type { Control } from "react-hook-form";

import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { RecipientField } from "@/features/mail/components/compose-form/check-recipients";
import type { ComposeFormValues } from "@/features/mail/schemas/compose-form";
import { MAX_RECIPIENTS_TEXT } from "@/features/mail/schemas/compose-input-limits";
import { fieldLength } from "@/lib/field-length";

/** One of the three recipient fields: the same input, three names. */
export function RecipientInput({
	control,
	name,
	label,
	translate,
}: {
	control: Control<ComposeFormValues>;
	name: RecipientField;
	label: string;
	translate: (message: string) => string;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<Input
							{...field}
							type="text"
							maxLength={fieldLength(MAX_RECIPIENTS_TEXT)}
							inputMode="email"
							autoCapitalize="none"
							autoComplete="off"
							spellCheck={false}
						/>
					</FormControl>
					<FormMessage render={translate} />
				</FormItem>
			)}
		/>
	);
}
