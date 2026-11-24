const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
const faces=['U','R','F','D','L','B'];
(async()=>{
  process.env.CUBE_PORT='4331';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4331');
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')));
    const pattern=async()=>{const s=await saved();return s.stickers.map(c=>c==='k'?'*':faces[s.centers.indexOf(c)]||'?').join('');};
    const size=async n=>{for(const a of ['x','y','z'])await page.locator('#size-'+a).fill(String(n));await page.locator('#apply-size').click();};
    const solve=async()=>{await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});};
    const run=async()=>{await page.locator('#animation-enabled').uncheck();await page.locator('#run-speed').evaluate(el=>{el.value='120';el.dispatchEvent(new Event('input'));});await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');};
    const model=new CuboidModel();assert.equal(model.centerFrames().length,24);assert(model.cells.every(c=>!c.locked));
    await page.locator('#all-black').click();await page.locator('#palette button[aria-label^="红色"]').click();const center=()=>page.locator('.face[data-face="F"] .sticker').nth(4);assert(await center().isEnabled());await center().click();const start=await pattern();assert.equal(start[22],'R');const target=(await saved()).centers;
    await page.reload();assert.equal((await pattern())[22],'R');assert.deepEqual((await saved()).centers,target);await solve();await run();assert(model.isSolved(await pattern()));await page.locator('#reset-run').click();assert.equal(await pattern(),start);await page.locator('#clear').click();assert((await saved()).stickers.every(c=>c===null));
    await page.locator('#manual-colors').evaluate(el=>el.open=true);await page.locator('#face-input').fill('G4R1G4');await page.locator('#apply-face').click();assert.equal((await saved()).stickers[22],'r');assert.match(await page.locator('#face-input-status').innerText(),/已应用/);await page.reload();assert.equal((await saved()).stickers[22],'r');
    await size(3);await page.locator('details.manual').evaluate(el=>el.open=true);assert.equal(await page.locator('#manual-layer option').count(),3);let middle=model.solved;
    for(const axis of ['X','Y','Z']){await page.locator('#manual-axis').selectOption(axis);await page.locator('#manual-layer').selectOption('1');await page.locator('#manual-apply').click();await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);middle=model.apply(middle,{axis,layer:1,turns:1});assert.equal(await pattern(),middle);}
    assert.notEqual(faces.map((f,i)=>middle[i*9+4]).join(''),faces.join(''));await solve();await run();assert(model.isSolved(await pattern()));
    // Test the real worker with no history: mixed outer/middle layers and hidden centers.
    let seed=91381;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},legal=model.legalMoves(),fixtures=[];
    for(let i=0;i<12;i++){let text=model.solved;for(let j=0;j<22;j++)text=model.apply(text,legal[Math.floor(random()*legal.length)]);if(i%3===1)text=[...text].map((c,j)=>j%9===4?'*':c).join('');if(i%3===2)text=[...text].map((c,j)=>j%4===0?'*':c).join('');fixtures.push(text);}
    const results=await page.evaluate(async texts=>{const worker=new Worker('solver-worker.js?v=centers1');try{const output=[];for(let i=0;i<texts.length;i++){const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('worker timeout')),60000);worker.onmessage=({data})=>{if(data.id!==i||data.kind==='progress')return;clearTimeout(timeout);resolve(data);};worker.postMessage({id:i,text:texts[i],dimensions:[3,3,3],history:null,parallel:true});});output.push(result);}return output;}finally{worker.terminate();}},fixtures);
    for(let i=0;i<results.length;i++){const result=results[i];assert.equal(result.kind,'result',result.message);let text=fixtures[i];for(const group of result.groups)text=model.applyGroup(text,group);assert(model.isSolved(text));for(const m of result.moves)assert(model.normalize(m));}
    await page.locator('#all-black').click();await page.locator('#palette button[aria-label^="红色"]').click();for(const f of ['U','R'])await page.locator(`.face[data-face="${f}"] .sticker`).nth(4).click();await page.locator('#solve').click();await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.match(await page.locator('#status').innerText(),/中心颜色/);
    for(const n of [3,7]){await size(n);await page.locator('#black-percent').fill('100');await page.locator('#random-black').click();assert.equal((await saved()).stickers.filter(c=>c==='k').length,6*n*n);assert.equal(await page.locator('.center:disabled').count(),0);assert(await page.locator('.face[data-face="F"] .sticker').nth(Math.floor(n*n/2)).isEnabled());}
    await size(3);await page.locator('#all-black').click();await page.locator('#palette button[aria-label^="红色"]').click();await center().click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'editable-centers-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
    console.log('PASS: center click/text import/reload preserve target colors; sparse center restoration and exact reset; all 3 middle axes; 12 history-free mixed-layer solves including masked centers; impossible center arrangement rejected; 3/7 center masking and mobile layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
