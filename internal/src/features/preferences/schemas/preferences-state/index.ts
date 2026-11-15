import type { PreferenceField } from "@/features/preferences/config/fields";
import type {
	PreferenceErrorKey,
	PreferencesInput,
} from "@/features/preferences/schemas/preferences";

/**
 * What the save action reports back to its form, as a union and not a set of
 * flags. `refused` names each field that was not accepted and why, and nothing
 * was stored. `failed` is anything that is not the person's doing: no session
 * (the answer is the same for a missing and for an expired one) or a store that
 * could not be written. `saved` carries what was stored.
 */
export type PreferencesState =
	| { readonly outcome: "idle" }
	| { readonly outcome: "saved"; readonly values: PreferencesInput }
	| {
			readonly outcome: "refused";
			readonly fields: Readonly<
				Partial<Record<PreferenceField, PreferenceErrorKey>>
			>;
	  }
	| { readonly outcome: "failed" };

/** The state before the first save. */
export const INITIAL_PREFERENCES_STATE: PreferencesState = {
	outcome: "idle",
};
