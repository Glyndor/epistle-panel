import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * The input of the locale switcher: one of the shipped locales, exactly. The
 * same schema validates the choice in the client menu and again in the Server
 * Action, which is the real gate.
 */
export const localeSchema = z.enum(SUPPORTED_LOCALES);
