import "server-only";

import manifest from "../../../package.json";

/**
 * The version of the panel that is running, as its own `package.json` states
 * it: the release workflow refuses a tag that disagrees with that file, so
 * this is the version of the image. Read on the server only; the manifest
 * never reaches the browser.
 */
export const PANEL_VERSION: string = manifest.version;
