import { z } from "zod/mini";

import { THEME_CHOICES } from "@/features/theme/config/choices";

/**
 * The input of the theme menu: one of the choices, exactly. The same schema
 * validates the choice in the menu and again in the Server Action, which is
 * the real gate. It uses `zod/mini` because the menu ships it to the browser.
 */
export const themeChoiceSchema = z.enum(THEME_CHOICES);
