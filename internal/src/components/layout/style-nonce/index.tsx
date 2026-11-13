"use client";

import { setNonce } from "get-nonce";
import { useEffect } from "react";

/**
 * Hands the request's nonce to the library that locks page scroll under a modal
 * dialog. It injects one `<style>` element, and the policy accepts a style
 * element only with the nonce (`style-src-elem 'self' 'nonce-…'`, no
 * `'unsafe-inline'`). The nonce is the one Next stamped on its own scripts, read
 * from the first of them; it renders nothing.
 */
export function StyleNonce() {
	useEffect(() => {
		const script =
			document.querySelector<HTMLScriptElement>("script[nonce]");
		setNonce(script?.nonce ?? "");
	}, []);
	return null;
}
