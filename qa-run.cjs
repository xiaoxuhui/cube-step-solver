const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
(async()=>{
  process.env.CUBE_PORT='4319';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4319');
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')));
    const setSpeed=async value=>page.locator('#run-speed').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input'));},String(value));
    async function size(dims){for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));await page.locator('#apply-size').click();}
    async function solve(){await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:180000});}
    await size([7,7,7]);await page.locator('#demo').click();await page.locator('#random-black').click();await solve();
    assert.match(await page.locator('#solver-method').innerText(),/置换/);
    const start=await saved();await page.locator('#next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);
    await page.locator('#reset-run').click();assert.deepEqual((await saved()).stickers,start.stickers);assert.deepEqual((await saved()).history,start.history);
    await setSpeed(2);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='正在转动…');
    await page.locator('#run').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
    const paused=await page.locator('#step-count').innerText();await page.waitForTimeout(700);assert.equal(await page.locator('#step-count').innerText(),paused,'pause must leave no scheduled extra steps');
    await setSpeed(30);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原',{},{timeout:30000});
    assert.match(await page.locator('#status').innerText(),/还原完成/);
    await page.locator('#reset-run').click();assert.deepEqual((await saved()).stickers,start.stickers);
    await setSpeed(.5);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='正在转动…');await page.locator('#reset-run').click();
    await page.waitForFunction(()=>document.getElementById('step-count').textContent.startsWith('0 /')&&!document.getElementById('next').disabled);
    await page.waitForTimeout(700);assert.deepEqual((await saved()).stickers,start.stickers);assert.equal(await page.locator('#run').innerText(),'运行');
    // A state entered without scramble history must be solved through permutation search.
    const model=new CuboidModel([7,7,7]),m1={axis:'X',layer:0,turns:1},m2={axis:'Y',layer:1,turns:1};
    const state=model.apply(model.apply(model.solved,m1),m2),centers=['w','r','g','y','o','b'];
    await page.evaluate(({state,centers})=>localStorage.setItem('cube-step-v1',JSON.stringify({dimensions:[7,7,7],centers,stickers:[...state].map(c=>centers[['U','R','F','D','L','B'].indexOf(c)]),speed:30})),{state,centers});
    await page.reload();await solve();assert.match(await page.locator('#solver-method').innerText(),/置换搜索/);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');
    console.log('PASS: autoplay, pause at step boundary, changing speed, exact reset before/after completion and during animation, and history-free high-order permutation search.');
    await size([100,100,100]);assert.equal(await page.locator('.tile').count(),0);assert.equal(await page.locator('#large-face-canvas').count(),1);
    assert.equal((await saved()).stickers.length,60000);
    await page.getByRole('button',{name:/^黑色，已填/}).click();
    await page.getByRole('spinbutton',{name:'大尺寸填色行',exact:true}).fill('100');await page.getByRole('spinbutton',{name:'大尺寸填色列',exact:true}).fill('100');await page.getByRole('button',{name:'填入当前颜色',exact:true}).click();
    const painted=await saved();assert.equal(painted.stickers[29999],'k');
    const begin=Date.now();await page.locator('#demo').click();await page.waitForFunction(()=>!document.getElementById('demo').disabled&&JSON.parse(localStorage.getItem('cube-step-v1')).scrambleCount>=600,{},{timeout:180000});
    const generated=await saved();assert(generated.scrambleCount>=600&&generated.scrambleCount<=1200);
    await page.locator('#random-black').click();assert.equal((await saved()).stickers.filter(c=>c==='k').length,24000);
    await solve();assert.match(await page.locator('#solver-method').innerText(),/置换/);
    console.log('PASS: 100x100x100 has 60000 stickers, canvas precise painting, background random generation ('+generated.scrambleCount+' moves) and verified solution in '+((Date.now()-begin)/1000).toFixed(1)+'s.');
    await setSpeed(30);const largeStart=await saved();await page.locator('#next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);await page.locator('#reset-run').click();assert.deepEqual((await saved()).stickers,largeStart.stickers);
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('.paint-count').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().width<=e.parentElement.getBoundingClientRect().width)),'large color counts must fit their buttons');
    await page.screenshot({path:'run-mobile-preview.png',fullPage:true});
    await page.setViewportSize({width:1360,height:1100});await page.screenshot({path:'run-desktop-preview.png',fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS: large-size one-step/reset and responsive canvas layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
