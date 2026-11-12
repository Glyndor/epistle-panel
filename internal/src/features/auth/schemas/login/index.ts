import * as z from "zod/mini";

import { CAPTCHA_TOKEN_MAX } from "@/features/auth/captcha/providers";

/** Longest account name accepted, in characters: an email address is at most 254. */
export const LOGIN_NAME_MAX = 254;

/**
 * Longest password accepted, in characters. A real password is a few dozen; the
 * cap keeps an anonymous request from handing the mail server a megabyte to hash
 * with argon2id.
 */
export const LOGIN_PASSWORD_MAX = 1024;

/**
 * The sign-in form's fields. The same schema validates in the browser, where a
 * failure is a hint next to the field, and in the Server Action, which is the
 * real gate and answers every failure with the same generic message. The error
 * texts are message keys of the `auth` namespace, translated where they show.
 * It is `zod/mini`: the page ships it, so the tree-shakable build keeps the
 * sign-in bundle small. The name is trimmed before its length is checked; the
 * password is taken as typed.
 */
export const loginSchema = z.object({
	name: z
		.string()
		.check(
			z.trim(),
			z.minLength(1, "nameRequired"),
			z.maxLength(LOGIN_NAME_MAX, "nameTooLong"),
		),
	password: z
		.string()
		.check(
			z.minLength(1, "passwordRequired"),
			z.maxLength(LOGIN_PASSWORD_MAX, "passwordTooLong"),
		),
	/** The CAPTCHA token, when the panel has one on; bounded like everything else. */
	captcha: z.optional(
		z.string().check(z.maxLength(CAPTCHA_TOKEN_MAX, "captchaRequired")),
	),
});

/**
 * The same schema for a panel whose CAPTCHA is on: the token is then required.
 * The form uses it to ask for the challenge before any request, and the Server
 * Action uses it before it spends a call on the provider.
 */
export const captchaLoginSchema = z.extend(loginSchema, {
	captcha: z
		.string()
		.check(
			z.minLength(1, "captchaRequired"),
			z.maxLength(CAPTCHA_TOKEN_MAX, "captchaRequired"),
		),
});

/** The message keys the schema can fail with, all in the `auth` namespace. */
export const LOGIN_ERROR_KEYS = [
	"captchaLoadFailed",
	"captchaRequired",
	"nameRequired",
	"nameTooLong",
	"passwordRequired",
	"passwordTooLong",
] as const;
export type LoginErrorKey = (typeof LOGIN_ERROR_KEYS)[number];

/** Whether a message a field failed with is one of the schema's keys. */
export function isLoginErrorKey(message: string): message is LoginErrorKey {
	return (LOGIN_ERROR_KEYS as readonly string[]).includes(message);
}

/** What the form holds, before validation. */
export type LoginInput = z.input<typeof loginSchema>;
