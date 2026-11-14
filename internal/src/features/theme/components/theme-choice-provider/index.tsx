"use client";

import { createContext, useContext } from "react";

import {
	DEFAULT_THEME_CHOICE,
	type ThemeChoice,
} from "@/features/theme/config/choices";

const ServerThemeChoice = createContext<ThemeChoice>(DEFAULT_THEME_CHOICE);

/**
 * Hands the choice the server read from the cookie, and painted on `<html>`,
 * to the client components below. They need it only while they are rendered
 * on the server and hydrated, when there is no document to look at; after
 * that they read the attribute (`hooks/use-theme-choice`). The root layout
 * mounts it once, so no header has to read the cookie itself.
 */
export function ThemeChoiceProvider({
	choice,
	children,
}: {
	choice: ThemeChoice;
	children: React.ReactNode;
}) {
	return <ServerThemeChoice value={choice}>{children}</ServerThemeChoice>;
}

/** The choice the server painted on `<html>` for this request. */
export function useServerThemeChoice(): ThemeChoice {
	return useContext(ServerThemeChoice);
}
