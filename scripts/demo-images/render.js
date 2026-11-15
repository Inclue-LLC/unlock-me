// デモ用の写真風商品画像を生成する（Playwright が必要）: node scripts/demo-images/render.js public/demo
const { chromium } = require('playwright');
const path = require('path');
const { scenes, defs, finish, S } = require('./scenes');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  let i = 0;
  for (const [name, fn] of Object.entries(scenes)) {
    i += 10;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs(i)}${fn(i)}${finish()}</svg>`;
    await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: S, height: S } });
    console.log('rendered', name);
  }
  await b.close();
})();
