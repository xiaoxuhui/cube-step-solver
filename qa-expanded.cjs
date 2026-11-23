const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Cube=require('./dist/vendor/cube');
const {formatFace}=require('./dist/color-input');
(async()=>{
  process.env.CUBE_PORT='4321';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4321');
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')));
    const pattern=async()=>{const v=await saved();return v.stickers.map(c=>c==='k'?'*':['U','R','F','D','L','B'][v.centers.indexOf(c)]||'?').join('');};
    async function input(face,text){await page.locator('#manual-colors').evaluate(el=>el.open=true);await page.locator('#input-face').selectOption(face);await page.locator('#face-input').fill(text);await page.locator('#apply-face').click();}
    async function speed(n){await page.locator('#run-speed-number').fill(String(n));await page.locator('#run-speed-number').press('Tab');}
    async function size(dims){for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));await page.locator('#apply-size').click();}
    async function solve(){await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:180000});}
    await input('F','绿绿绿\n绿绿绿\n绿绿黑');assert.equal((await saved()).stickers[26],'k');
    const previous=await pattern();await input('F','G8');assert.match(await page.locator('#face-input-status').innerText(),/目前填写了 8 格/);assert.equal(await pattern(),previous);
    await input('F','G4R1G4');assert.match(await page.locator('#face-input-status').innerText(),/中心必须/);assert.equal(await pattern(),previous);
    const target=new Cube().move("R U F2 L' B D R2 U2 F'").asString(),faces=['U','R','F','D','L','B'],centers=['w','r','g','y','o','b'];
    for(let i=0;i<6;i++)await input(faces[i],formatFace([...target.slice(i*9,i*9+9)].map(c=>centers[faces.indexOf(c)]),3));
    assert.equal(await pattern(),target);await solve();
    await speed(10);assert.equal(await page.locator('#run-speed').inputValue(),'10');
    const startSlow=Date.now();await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');const slow=Date.now()-startSlow;
    await page.locator('#reset-run').click();assert.equal(await pattern(),target);await speed(120);assert.equal(await page.locator('#run-speed').inputValue(),'120');
    const startFast=Date.now();await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');const fast=Date.now()-startFast;
    assert(fast<slow*.65,`120-step execution must beat 10-step execution: ${fast} vs ${slow}`);
    await speed(121);assert.match(await page.locator('#status').innerText(),/0.5 到 120/);assert.equal(await page.locator('#run-speed').inputValue(),'120');
    await page.reload();assert.equal(await page.locator('#run-speed').inputValue(),'120');
    console.log('PASS: six-face manual text input, invalid count/center protection, solving imported colors, speed-number synchronization and persistence; 10-step run '+slow+'ms vs 120-step run '+fast+'ms.');
    await size([7,7,7]);await page.locator('#demo').click();await solve();const before=await pattern();await page.locator('#run').click();await page.waitForFunction(()=>!document.getElementById('step-count').textContent.startsWith('0 /'));await page.locator('#run').click();
    const paused=await pattern();await page.waitForTimeout(100);assert.equal(await pattern(),paused);await page.locator('#reset-run').click();assert.equal(await pattern(),before);
    await size([200,200,200]);assert.equal((await saved()).stickers.length,240000);await input('F','K40000');const large=await saved();assert(large.stickers.slice(80000,120000).every(c=>c==='k'));
    const start=Date.now();await page.locator('#demo').click();await page.waitForFunction(()=>!document.getElementById('demo').disabled&&JSON.parse(localStorage.getItem('cube-step-v1')).scrambleCount>=1200,{},{timeout:180000});
    const generated=await saved();assert(generated.scrambleCount>=1200&&generated.scrambleCount<=2400);await page.locator('#random-black').click();assert.equal((await saved()).stickers.filter(c=>c==='k').length,96000);
    await solve();assert.match(await page.locator('#solver-method').innerText(),/置换/);
    console.log('PASS: 200x200x200 precise manual import, '+generated.scrambleCount+'-move random generation, 96000 black stickers and full verified solution in '+((Date.now()-start)/1000).toFixed(1)+'s.');
    await page.locator('#manual-colors').evaluate(el=>el.open=true);await page.locator('#input-face').selectOption('F');await page.locator('#read-face').click();
    await page.screenshot({path:'expanded-desktop-preview.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#face-input').scrollIntoViewIfNeeded();await page.screenshot({path:'expanded-mobile-preview.png',fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS: high-speed pause/reset, large text readback and responsive layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
