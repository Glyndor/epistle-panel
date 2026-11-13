// node declare-only.mjs URL DECLARED_BYTES [COOKIE]
//
// Declares a request body of DECLARED_BYTES and sends none of it, then prints
// the status line's code, or "none" when nothing came back in three seconds.
// A server that answers has decided without the body; one that says nothing is
// waiting to hold it. curl cannot do this: it sends the body it declares.
import net from "node:net";

const [target, declared, cookie = ""] = process.argv.slice(2);
const url = new URL(target);
const socket = net.connect(Number(url.port), url.hostname);
let answer = "";
const finish = () => {
	const code = /^HTTP\/1\.[01] (\d{3})/.exec(answer)?.[1] ?? "none";
	process.stdout.write(`${code}\n`);
	socket.destroy();
	process.exit(0);
};
socket.on("connect", () => {
	socket.write(
		[
			`POST ${url.pathname}${url.search} HTTP/1.1`,
			`Host: ${url.host}`,
			`Origin: ${url.origin}`,
			"Content-Type: application/octet-stream",
			`Content-Length: ${declared}`,
			...(cookie === "" ? [] : [`Cookie: ${cookie}`]),
			"Connection: close",
			"",
			"",
		].join("\r\n"),
	);
});
socket.on("data", (chunk) => {
	answer += chunk.toString("latin1");
	if (answer.includes("\r\n")) {
		finish();
	}
});
socket.on("error", finish);
socket.on("close", finish);
setTimeout(finish, 3000);
