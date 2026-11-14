import { z } from "zod/mini";

import { LIST_DENSITIES } from "@/features/mail/config/list-density";

/**
 * The input of the density control: one of the densities, exactly. The same
 * schema checks the choice in the control and again in the Server Action,
 * which is the real gate. It uses `zod/mini` because the control ships it to
 * the browser.
 */
export const listDensitySchema = z.enum(LIST_DENSITIES);
