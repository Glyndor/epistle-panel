"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { LIST_DENSITIES } from "@/features/mail/config/list-density";
import { savePreferences } from "@/features/preferences/actions/save-preferences";
import { PreferenceField } from "@/features/preferences/components/preference-field";
import { PREFERENCE_FIELDS } from "@/features/preferences/config/fields";
import {
	isPreferenceErrorKey,
	type PreferencesInput,
	preferencesSchema,
} from "@/features/preferences/schemas/preferences";
import { INITIAL_PREFERENCES_STATE } from "@/features/preferences/schemas/preferences-state";
import { THEME_CHOICES } from "@/features/theme/config/choices";
import { applyThemeChoice } from "@/features/theme/document-theme";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * The preferences form, on react-hook-form with the schema the Server Action
 * enforces too. It is a real `<form action>`: without script the browser posts
 * the three selects and the action runs, so nothing here depends on hydration.
 * With script, three checks run in order: the browser's own (each select is
 * `required` and can hold only its own options), the schema here, which names
 * the field, and the action, which is the gate and refuses any value outside a
 * list, naming the field, whatever was posted by hand.
 *
 * `values` is what the server read and checked from the cookies, so the first
 * paint already shows the choice in force. A saved theme is shown at once on
 * `<html>`; the language and the density are what the page and the mail area
 * read on their next render, which the action's cookies cause.
 */
export function PreferencesForm({
	values,
	save = savePreferences,
}: {
	values: PreferencesInput;
	/**
	 * What the form posts to: the Server Action. A prop so a test can answer
	 * what the browser's own two checks never let reach the server.
	 */
	save?: typeof savePreferences;
}) {
	const t = useTranslations("me");
	const tNav = useTranslations("nav");
	const [state, formAction, pending] = useActionState(
		save,
		INITIAL_PREFERENCES_STATE,
	);
	const form = useForm<PreferencesInput>({
		resolver: zodResolver(preferencesSchema),
		defaultValues: values,
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const formElement = useRef<HTMLFormElement>(null);

	// `state` is a new object for every answer, so a second one runs this too.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `form` is stable
	useEffect(() => {
		if (state.outcome === "saved") {
			applyThemeChoice(state.values.theme);
		}
		if (state.outcome === "refused") {
			// The first field the server named, in the order the page draws them.
			const first = PREFERENCE_FIELDS.find(
				(name) => state.fields[name] !== undefined,
			);
			if (first !== undefined) {
				form.setFocus(first);
			}
		}
	}, [state]);

	const submit = form.handleSubmit(() => {
		const data = formElement.current
			? new FormData(formElement.current)
			: new FormData();
		startTransition(() => formAction(data));
	});

	// What the server refused, by field; also what a page posted with no script shows.
	const refusals = state.outcome === "refused" ? state.fields : {};
	const message = (key: string) => (isPreferenceErrorKey(key) ? t(key) : key);

	return (
		<Form {...form}>
			<form
				ref={formElement}
				action={formAction}
				onSubmit={(event) => void submit(event)}
				aria-label={t("formLabel")}
				className="flex max-w-md flex-col gap-4"
			>
				<PreferenceField
					control={form.control}
					name="language"
					label={t("language")}
					help={t("languageHelp")}
					renderMessage={message}
					refusal={refusals.language}
					options={SUPPORTED_LOCALES.map((code) => ({
						value: code,
						label: LOCALE_NAMES[code],
						lang: code,
					}))}
				/>
				<PreferenceField
					control={form.control}
					name="theme"
					label={t("theme")}
					help={t("themeHelp")}
					renderMessage={message}
					refusal={refusals.theme}
					options={THEME_CHOICES.map((choice) => ({
						value: choice,
						label: tNav(`theme_${choice}`),
					}))}
				/>
				<PreferenceField
					control={form.control}
					name="density"
					label={t("density")}
					help={t("densityHelp")}
					renderMessage={message}
					refusal={refusals.density}
					options={LIST_DENSITIES.map((density) => ({
						value: density,
						label: t(`density_${density}`),
					}))}
				/>
				{state.outcome === "saved" ? (
					<Alert role="status">
						<AlertDescription>{t("saved")}</AlertDescription>
					</Alert>
				) : null}
				{state.outcome === "refused" ? (
					<Alert variant="destructive">
						<AlertDescription>{t("refused")}</AlertDescription>
					</Alert>
				) : null}
				{state.outcome === "failed" ? (
					<Alert variant="destructive">
						<AlertDescription>{t("failed")}</AlertDescription>
					</Alert>
				) : null}
				<Button
					type="submit"
					// aria-disabled, not disabled: a disabled button gives up the focus,
					// and the next Tab would start again from the top of the page.
					aria-disabled={pending}
					aria-busy={pending}
					onClick={(event) => {
						if (pending) {
							event.preventDefault();
						}
					}}
					className="self-start aria-disabled:pointer-events-none aria-disabled:opacity-50"
				>
					{pending ? t("saving") : t("save")}
				</Button>
			</form>
		</Form>
	);
}
