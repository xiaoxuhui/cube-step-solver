const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
const {HugeCubeModel,MAX_DIMENSION,faces}=require('./dist/huge-model');
(async()=>{
  process.env.CUBE_PORT='4329';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4329');
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')));
    const pattern=async()=>{const s=await saved();return s.stickers.map(c=>c==='k'?'*':faces[s.centers.indexOf(c)]||'?').join('');};
    const size=async dims=>{for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));await page.locator('#apply-size').click();};
    for(const dims of [[3,3,3],[7,7,7],[200,200,200]]){
      await size(dims);await page.locator('#all-black').click();const s=await saved();assert.deepEqual(s.dimensions,dims);assert(s.stickers.every(c=>c==='k'));assert.equal(s.stickers.length,2*(dims[0]*dims[1]+dims[0]*dims[2]+dims[1]*dims[2]));assert.equal(new Set(s.centers).size,6);
      await page.reload();assert((await saved()).stickers.every(c=>c==='k'));await page.locator('#solve').click();assert.equal(await page.locator('#step-count').innerText(),'0 / 0');assert.match(await page.locator('#status').innerText(),/不需要转动/);assert(await page.locator('#next').isDisabled());
    }
    await size([3,3,3]);await page.locator('#all-black').click();await page.locator('#palette button[aria-label^="红色"]').click();await page.locator('#net .face[data-face="F"] .sticker').first().click();assert.equal((await pattern()).replaceAll('*',''),'R');
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});await page.locator('#animation-enabled').uncheck();await page.locator('#run-speed').evaluate(el=>{el.value='120';el.dispatchEvent(new Event('input'));});await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');assert(new CuboidModel().isSolved(await pattern()));assert.equal((await saved()).stickers.filter(c=>c==='k').length,53);
    await page.locator('#clear').click();const clear=await saved();assert.equal(clear.stickers.filter(c=>c===null).length,54);assert.deepEqual(clear.centers,['w','r','g','y','o','b']);
    await page.locator('#manual-colors').evaluate(el=>el.open=true);await page.locator('#face-input').fill('K9');await page.locator('#apply-face').click();assert((await saved()).stickers.slice(18,27).every(c=>c==='k'));await page.reload();assert((await saved()).stickers.slice(18,27).every(c=>c==='k'));
    await page.locator('#fill-max-size').click();await page.locator('#huge-clear').click();await page.locator('#all-black').click();const hugeSaved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cube-huge-v1')));
    let h=await hugeSaved();assert.deepEqual(h.state.dimensions,Array(3).fill(MAX_DIMENSION));assert(h.state.baseFaces.every(c=>c==='*'));assert.equal(h.state.edits.length,0);const model=HugeCubeModel.restore(h.state);for(const f of faces)assert.equal(model.colorAt(f,MAX_DIMENSION-1,MAX_DIMENSION-1),'*');
    await page.locator('#huge-solve').click();assert.equal(await page.locator('#huge-count').innerText(),'0 / 0 步');assert(await page.locator('#huge-next').isDisabled());await page.reload();assert((await hugeSaved()).state.baseFaces.every(c=>c==='*'));
    // Hidden pre-fill colors and an existing scramble must both be ignored by full black.
    await page.evaluate(()=>{const m=new HugeCube.HugeCubeModel(Array(3).fill(HugeCube.MAX_DIMENSION));m.scramble(90);m.paint('F',0,0,'?');const data=JSON.parse(localStorage.getItem('cube-huge-v1'));data.state=m.snapshot();localStorage.setItem('cube-huge-v1',JSON.stringify(data));});await page.reload();const turns=(await hugeSaved()).state.turns;await page.locator('#all-black').click();h=await hugeSaved();assert.deepEqual(h.state.turns,turns);assert.equal(h.state.edits.length,0);await page.locator('#huge-solve-parallel').click();assert.equal(await page.locator('#huge-count').innerText(),'0 / 0 组');
    await page.setViewportSize({width:390,height:844});assert(await page.locator('#all-black').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'all-black-mobile-preview.png',fullPage:true});await size([3,3,3]);await page.locator('#all-black').click();await page.setViewportSize({width:1360,height:1000});await page.screenshot({path:'all-black-desktop-preview.png',fullPage:true});assert.deepEqual(errors,[]);
    console.log('PASS: one-click full black including 3x3 centers, persistence and zero-step completion at 3/7/200 and maximum dimensions; sparse color re-entry solved with masked centers, clear includes centers and preserves targets, K9 import, exact huge black including unknown cells, retained histories and phone layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
