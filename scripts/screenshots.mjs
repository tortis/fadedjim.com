import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:4321/';
const shots = [
	{ name: 'hero', y: 0 },
	{ name: 'cuts', selector: '#cuts' },
	{ name: 'bookcta', selector: 'main section:nth-of-type(3)' },
	{ name: 'about', selector: '#about' },
	{ name: 'hours', selector: '#hours' },
	{ name: 'reviews', selector: '#reviews' },
	{ name: 'footer', selector: 'footer' },
];

const browser = await puppeteer.launch({
	executablePath: '/bin/chromium',
	args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

for (const width of [390, 1440]) {
	const page = await browser.newPage();
	await page.setViewport({ width, height: 900 });
	await page.goto(url, { waitUntil: 'networkidle0' });
	// Force all reveals visible + disable smooth scroll for deterministic captures
	await page.addStyleTag({
		content: 'html{scroll-behavior:auto} .reveal{opacity:1 !important;transform:none !important}',
	});
	const label = width < 600 ? 'm' : 'd';
	for (const shot of shots) {
		if (shot.selector) {
			await page.evaluate((sel) => {
				document.querySelector(sel)?.scrollIntoView({ block: 'start' });
			}, shot.selector);
		} else {
			await page.evaluate((y) => window.scrollTo(0, y), shot.y ?? 0);
		}
		await new Promise((r) => setTimeout(r, 400));
		await page.screenshot({ path: `/tmp/opencode/pp-${label}-${shot.name}.png` });
	}
	await page.close();
}

await browser.close();
console.log('screenshots done');
