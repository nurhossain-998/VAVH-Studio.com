const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, '..');
const scripts = [
  'client/js/utils/helpers.js',
  'client/js/components/productCard.js',
  'client/js/components/toast.js',
].map((file) => fs.readFileSync(path.join(workspace, file), 'utf8'));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: false, nodeIntegration: false } });
  await window.loadURL('data:text/html,<body><div id="toastContainer"></div></body>');
  const script = `window.VAVH={}; ${scripts.join('\n')}\nwindow.VAVH.DEFAULT_PRODUCT_IMG='data:image/png;base64,AA=='; window.VAVH.CURRENCY='BDT'; window.Storage={isWishlisted:()=>false}; window.ProductModal={}; window.Cart={}; window.Wishlist={};`;
  await window.webContents.executeJavaScript(script);
  const result = await window.webContents.executeJavaScript(`(() => {
    const payload = '<img src=x onerror=alert(1)>';
    const card = window.buildProductCard({ id: 'test-1', name: payload, category_name: payload, image_url: 'javascript:alert(1)', price: 10 });
    document.body.appendChild(card);
    window.Toast.show(payload, 'info', 0);
    const html = card.outerHTML;
    const toastText = document.querySelector('.toast span:last-child')?.textContent || '';
    return {
      rawPayloadInCard: html.includes(payload),
      executableImage: html.includes('javascript:alert'),
      toastTextMatches: toastText === payload,
      inlineHandlers: [...card.querySelectorAll('*')].some((element) =>
        [...element.attributes].some((attribute) => /^on/i.test(attribute.name))
      ),
    };
  })()`);
  window.close();
  app.quit();
  if (result.rawPayloadInCard || result.executableImage || !result.toastTextMatches || result.inlineHandlers) {
    console.error(JSON.stringify(result));
    process.exitCode = 1;
    return;
  }
  console.log('Browser XSS smoke test passed:', JSON.stringify(result));
}).catch((error) => {
  console.error('Browser XSS smoke test failed:', error.message);
  app.exit(1);
});
