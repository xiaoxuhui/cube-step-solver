const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  process.env.CUBE_PORT='4318';
  const server=require('./server.cjs');
  await new Promise(resolve=>server.once('listening',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4318');
    assert.equal(await page.locator('.sticker').count(),54);
    assert.equal(await page.locator('.tile').count(),54);
    await page.locator('#demo').click();
    const start=await page.locator('.sticker').evaluateAll(es=>es.map(e=>e.style.background).join('|'));
    await page.locator('#solve').click();
    await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    await page.screenshot({path:'desktop-preview.png',fullPage:true});
    await page.locator('#next').click();
    assert.match(await page.locator('#step-count').innerText(),/^1 \/ /);
    await page.locator('#prev').click();
    assert.equal(await page.locator('.sticker').evaluateAll(es=>es.map(e=>e.style.background).join('|')),start);
    let n=0;while(await page.locator('#next').isEnabled()){await page.locator('#next').click();if(++n>40)throw Error('too many steps');}
    assert.match(await page.locator('#status').innerText(),/还原完成/);
    assert(await page.locator('.face-grid').evaluateAll(grids=>grids.every(g=>new Set([...g.children].map(e=>e.style.background)).size===1)));
    await page.locator('#demo').click();
    await page.locator('#manual-axis').selectOption('Z');
    await page.locator('.manual summary').click();
    await page.locator('#manual-apply').click();
    assert.match(await page.locator('#status').innerText(),/Z 轴/);
    await page.locator('#solve').click();
    await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'mobile-preview.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile must not overflow');
    await page.locator('#clear').click();await page.locator('#solve').click();
    assert.match(await page.locator('#status').innerText(),/未填写/);
    await page.getByRole('button',{name:'红色，已填 1 格',exact:true}).click();
    await page.getByRole('button',{name:'上面 1行 1列，未填',exact:true}).click();
    await page.reload();
    await page.getByRole('button',{name:'上面 1行 1列，红',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: browser worker solve, one-step execution, undo, complete restoration, manual axis rotation, mobile layout, input validation and persistence.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
