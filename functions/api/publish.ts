/**
 * POST /api/publish — commits admin-form content to the GitHub repo,
 * which triggers a Cloudflare Pages rebuild.
 *
 * Expects multipart/form-data:
 *   password — shared secret, compared to ADMIN_PASSWORD env var
 *   data     — JSON string matching src/data/data.json's shape
 *   files    — zero or more image files (File.name = target filename)
 *
 * Env: GITHUB_TOKEN (fine-grained PAT, repo-scoped, contents: rw), ADMIN_PASSWORD.
 */

const REPO = 'tortis/fadedjim.com';
const BRANCH = 'main';
const DATA_PATH = 'src/data/data.json';
const IMAGE_DIR = 'src/data/images/';
const IMAGE_NAME_RE = /^[\w][\w.-]*\.(jpg|jpeg|png)$/;

interface Env {
	GITHUB_TOKEN?: string;
	ADMIN_PASSWORD?: string;
}

interface DataJson {
	links: { booking_url: string; instagram_handle: string; instagram_url: string };
	copy: {
		hero_subtitle: string;
		about_paragraph_1: string;
		about_paragraph_2: string;
		hours_note: string;
		footer_follow_line: string;
	};
	hours: { days: string; time: string }[];
	reviews: { quote: string; name: string }[];
	cuts: { image: string; alt: string }[];
}

const json = (body: unknown, status = 200) =>
	Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function validateData(d: unknown): d is DataJson {
	if (typeof d !== 'object' || d === null) return false;
	const data = d as Record<string, unknown>;
	const links = data.links as Record<string, unknown> | undefined;
	const copy = data.copy as Record<string, unknown> | undefined;
	return (
		!!links &&
		isNonEmptyString(links.booking_url) &&
		isNonEmptyString(links.instagram_handle) &&
		isNonEmptyString(links.instagram_url) &&
		!!copy &&
		[
			'hero_subtitle',
			'about_paragraph_1',
			'about_paragraph_2',
			'hours_note',
			'footer_follow_line',
		].every((k) => isNonEmptyString(copy[k])) &&
		Array.isArray(data.hours) &&
		data.hours.length > 0 &&
		data.hours.every((r) => isNonEmptyString(r?.days) && isNonEmptyString(r?.time)) &&
		Array.isArray(data.reviews) &&
		data.reviews.length > 0 &&
		data.reviews.every((r) => isNonEmptyString(r?.quote) && isNonEmptyString(r?.name)) &&
		Array.isArray(data.cuts) &&
		data.cuts.length > 0 &&
		data.cuts.every(
			(c) => isNonEmptyString(c?.image) && IMAGE_NAME_RE.test(c.image) && isNonEmptyString(c?.alt),
		)
	);
}

function toBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(bin);
}

async function passwordMatches(submitted: string, expected: string): Promise<boolean> {
	const [a, b] = await Promise.all(
		[submitted, expected].map((s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))),
	);
	return crypto.subtle.timingSafeEqual(a, b);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.GITHUB_TOKEN || !env.ADMIN_PASSWORD) {
		return json({ error: 'Endpoint is not configured.' }, 500);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Expected multipart/form-data.' }, 400);
	}

	const password = form.get('password');
	if (typeof password !== 'string' || !(await passwordMatches(password, env.ADMIN_PASSWORD))) {
		return json({ error: 'Wrong password.' }, 401);
	}

	let data: unknown;
	try {
		data = JSON.parse(String(form.get('data') ?? ''));
	} catch {
		return json({ error: 'The data field is not valid JSON.' }, 400);
	}
	if (!validateData(data)) {
		return json({ error: 'The data payload is missing required fields.' }, 400);
	}

	// Only accept images the payload actually references (plus Jim's portrait).
	const referenced = new Set(data.cuts.map((c) => c.image));
	const uploads: { name: string; content: string }[] = [];
	for (const value of form.getAll('files')) {
		if (!(value instanceof File)) continue;
		const name = value.name;
		if (name !== 'jim.jpg' && !referenced.has(name)) continue;
		if (!IMAGE_NAME_RE.test(name) || !value.type.startsWith('image/')) continue;
		uploads.push({ name, content: toBase64(await value.arrayBuffer()) });
	}

	// GitHub Git Data API: blobs → tree → commit → ref update (one atomic commit).
	const gh = async (path: string, init?: RequestInit) => {
		const res = await fetch(`https://api.github.com/repos/${REPO}/git${path}`, {
			...init,
			headers: {
				authorization: `Bearer ${env.GITHUB_TOKEN}`,
				accept: 'application/vnd.github+json',
				'x-github-api-version': '2022-11-28',
				'user-agent': 'fadedjim-admin',
				...(init?.body ? { 'content-type': 'application/json' } : {}),
			},
		});
		if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
		return res.json() as Promise<any>;
	};
	const post = (path: string, body: unknown) => gh(path, { method: 'POST', body: JSON.stringify(body) });

	try {
		const ref = await gh(`/refs/heads/${BRANCH}`);
		const headCommit = await gh(`/commits/${ref.object.sha}`);
		const baseTreeSha = headCommit.tree.sha;

		const blobs = new Map<string, string>(); // repo path → blob sha
		const dataJson = JSON.stringify(data, null, '\t') + '\n';
		const dataBlob = await post('/blobs', {
			content: toBase64(new TextEncoder().encode(dataJson).buffer as ArrayBuffer),
			encoding: 'base64',
		});
		blobs.set(DATA_PATH, dataBlob.sha);
		for (const up of uploads) {
			const blob = await post('/blobs', { content: up.content, encoding: 'base64' });
			blobs.set(`${IMAGE_DIR}${up.name}`, blob.sha);
		}

		// Prune cut images that are no longer referenced (replaced or removed rows).
		const treeList = await gh(`/trees/${baseTreeSha}?recursive=1`);
		const pruned = (treeList.tree as { path: string }[])
			.filter(
				(e) =>
					e.path.startsWith(IMAGE_DIR) &&
					!blobs.has(e.path) &&
					IMAGE_NAME_RE.test(e.path.slice(IMAGE_DIR.length)) &&
					!referenced.has(e.path.slice(IMAGE_DIR.length)) &&
					e.path !== `${IMAGE_DIR}jim.jpg`,
			)
			.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: null }));

		const tree = await post('/trees', {
			base_tree: baseTreeSha,
			tree: [
				...[...blobs].map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })),
				...pruned,
			],
		});

		const commit = await post('/commits', {
			message: 'Content update via admin form',
			tree: tree.sha,
			parents: [ref.object.sha],
		});
		await gh(`/refs/heads/${BRANCH}`, {
			method: 'PATCH',
			body: JSON.stringify({ sha: commit.sha }),
		});

		return json({ ok: true, commitUrl: commit.html_url });
	} catch (err) {
		return json({ error: `Publish failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
	}
};
