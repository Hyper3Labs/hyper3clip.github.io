const { chromium } = require('playwright');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = process.env.SITE_URL || 'http://127.0.0.1:8000/';

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(500, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
  });
}

async function waitForImages(page) {
  await page.waitForFunction(() => [...document.images].every(
    (image) => image.complete && image.naturalWidth > 0
  ), null, { timeout: 10000 }).catch(() => {});
}

async function inspectPage(page, label, screenshotPath) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await scrollThrough(page);
  await waitForImages(page);
  await page.waitForTimeout(2500);

  const embeddedDemo = page.frames().find((frame) => (
    frame.url().startsWith('https://hyper3labs-hyperview.hf.space/')
  ));
  if (embeddedDemo) {
    await embeddedDemo.getByText('One image collection.', { exact: true })
      .waitFor({ timeout: 12000 })
      .catch(() => {});
  }

  const browserState = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('h1')?.textContent.trim(),
    imageFailures: [...document.images]
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflowElements: [...document.querySelectorAll('body *')]
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className : '',
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width)
      }))
      .filter((item) => item.right > window.innerWidth + 1 || item.left < -1)
      .slice(0, 15),
    localLinks: [...document.querySelectorAll('a[href]')]
      .map((link) => link.getAttribute('href'))
      .filter((href) => href && !/^(https?:|mailto:|#)/.test(href)),
    posterLink: document.querySelector('a[href="static/pdfs/hyper3clip-poster.pdf"]')
      ?.textContent.trim() || null,
    iframeSrc: document.querySelector('#demo iframe')?.getAttribute('src') || null
  }));

  if (label === 'desktop') {
    await page.locator('[data-copy-bibtex]').click();
    await page.waitForTimeout(100);
    browserState.copyButtonText = await page.locator('[data-copy-bibtex]').textContent();
    browserState.frames = page.frames().map((frame) => frame.url());
    browserState.embeddedDemoText = embeddedDemo
      ? (await embeddedDemo.locator('body').innerText()).slice(0, 300)
      : null;
    await page.locator('#demo').screenshot({ path: '/private/tmp/hyper3clip-demo-embedded.png' });
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    label,
    status: response?.status(),
    errors,
    ...browserState
  };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox']
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  });

  const desktop = await inspectPage(
    await desktopContext.newPage(),
    'desktop',
    '/private/tmp/hyper3clip-desktop-scrolled.png'
  );
  const mobile = await inspectPage(
    await mobileContext.newPage(),
    'mobile',
    '/private/tmp/hyper3clip-mobile-scrolled.png'
  );

  const socialPage = await desktopContext.newPage();
  await socialPage.setViewportSize({ width: 1200, height: 630 });
  await socialPage.goto(new URL('social-preview.html', baseUrl).href, {
    waitUntil: 'networkidle'
  });
  await socialPage.screenshot({
    path: 'static/images/social_preview.png',
    clip: { x: 0, y: 0, width: 1200, height: 630 }
  });

  const demoPage = await desktopContext.newPage();
  await demoPage.setViewportSize({ width: 1180, height: 720 });
  await demoPage.goto('https://hyper3labs-hyperview.hf.space/', {
    waitUntil: 'domcontentloaded'
  });
  await demoPage.waitForTimeout(8000);
  const demo = {
    title: await demoPage.title(),
    bodyText: (await demoPage.locator('body').innerText()).slice(0, 500)
  };
  await demoPage.screenshot({ path: '/private/tmp/hyperview-direct.png' });

  await browser.close();
  process.stdout.write(`${JSON.stringify({ desktop, mobile, demo }, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
