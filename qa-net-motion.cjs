const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
(async()=>{
  process.env.CUBE_PORT='4322';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4322');
    async function size(dims){for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));await page.locator('#apply-size').click();}
    const current=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cube-step-v1'));return s.stickers.map(c=>c==='k'?'*':CubeCore.faces[s.centers.indexOf(c)]||'?').join('');});
    const speed=n=>page.locator('#run-speed').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input'));},String(n));
    await page.evaluate(()=>{
      window.netFrames=[];window.sceneAngle=null;
      const scene=LargeCubeView.prototype.renderScene;LargeCubeView.prototype.renderScene=function(args){scene.call(this,args);if(args.rotation)window.sceneAngle=args.rotation.angle;};
      const frame=NetMotion.NetTurnView.prototype.frame;NetMotion.NetTurnView.prototype.frame=function(progress){frame.call(this,progress);const group=document.querySelector('.turn-layer');window.netFrames.push({progress,sceneAngle:window.sceneAngle,group:group?.style.transform||'',large:!!this.session?.base,faceTurn:!!this.session?.faceTurn});};
    });
    for(const axis of ['X','Y','Z']){
      await size([3,3,3]);await speed(.5);await page.locator('#animation-enabled').check();await page.locator('details.manual').evaluate(el=>el.open=true);await page.locator('#manual-axis').selectOption(axis);
      await page.evaluate(()=>window.netFrames=[]);await page.locator('#manual-apply').click();
      await page.waitForFunction(()=>window.netFrames.some(f=>f.progress>.15&&f.progress<.85),{},{polling:10});
      assert.equal(await page.locator('.net-motion-canvas').count(),1);assert(await page.locator('.face.is-affected').count()>0);
      if(axis==='X')await page.locator('#net').screenshot({path:'net-mid-turn.png'});
      await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);
      const frames=await page.evaluate(()=>window.netFrames);assert(frames.length>=3);
      for(const frame of frames){const angle=Number(frame.group.match(/\(([-\d.]+)deg\)/)?.[1]);assert(Math.abs(angle-(axis==='Y'?-90:90)*frame.progress)<1e-3,'DOM 3D and net must share the same animation clock within CSS serialization precision');}
      assert.equal(await page.locator('.net-motion-canvas').count(),0);assert.equal(await current(),new CuboidModel().apply(new CuboidModel().solved,{axis,layer:2,turns:1}));
    }
    // Pausing mid-step must keep the active net overlay until the step completes.
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);const before=await current();await page.evaluate(()=>window.netFrames=[]);await page.locator('#net-run').click();await page.waitForFunction(()=>window.netFrames.some(f=>f.progress>.05),{},{polling:10});await page.locator('#net-run').click();
    assert.equal(await page.locator('.net-motion-canvas').count(),1);await page.waitForFunction(()=>!document.getElementById('prev').disabled);await page.locator('#net-reset').click();assert.equal(await current(),before);assert.match(await page.locator('#net-process-label').innerText(),/已执行 0/);
    await page.evaluate(()=>window.netFrames=[]);await page.locator('#net-next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);await page.locator('#prev').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await current(),before);
    // When the current large face is unaffected, follow another face and animate its bitmap.
    await size([13,13,13]);await page.locator('details.manual').evaluate(el=>el.open=true);await page.locator('#manual-axis').selectOption('Z');await page.locator('#manual-layer').selectOption('6');await page.locator('#manual-turn').selectOption('');
    await page.evaluate(()=>window.netFrames=[]);await page.locator('#manual-apply').click();await page.waitForFunction(()=>window.netFrames.some(f=>f.large&&f.progress>.1),{},{polling:10});
    assert.notEqual(await page.locator('.face-tabs button[aria-pressed="true"]').innerText(),'前 F');await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);
    const largeFrames=await page.evaluate(()=>window.netFrames);for(const f of largeFrames)assert(Math.abs(f.sceneAngle-90*f.progress)<1e-6,'canvas 3D and net must share the same animation clock');
    const model=new CuboidModel([13,13,13]);assert.equal(await current(),model.apply(model.solved,{axis:'Z',layer:6,turns:1}));
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);const largeBefore=await current();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#net').classList.contains('net-turning'),{},{polling:10});await page.locator('#reset-run').click();await page.waitForFunction(()=>document.getElementById('step-count').textContent.startsWith('0 /')&&!document.getElementById('next').disabled);assert.equal(await current(),largeBefore);assert.equal(await page.locator('.net-turning').count(),0);
    // Large outer-face animation and the 200-layer interior animation both finish correctly.
    await page.locator('#manual-axis').selectOption('X');await page.locator('#manual-layer').selectOption('12');await page.locator('.face-tabs button[data-face="R"]').click();await page.evaluate(()=>window.netFrames=[]);await page.locator('#manual-apply').click();await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);assert((await page.evaluate(()=>window.netFrames)).some(f=>f.faceTurn),'outer-face bitmap must rotate too');
    await size([200,200,200]);await page.locator('details.manual').evaluate(el=>el.open=true);await page.locator('#manual-axis').selectOption('X');await page.locator('#manual-layer').selectOption('99');await speed(4);
    await page.evaluate(()=>window.netFrames=[]);await page.locator('#manual-apply').click();await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);assert((await page.evaluate(()=>window.netFrames)).some(f=>f.large&&f.progress>0&&f.progress<1));
    const biggest=new CuboidModel([200,200,200]);assert.equal(await current(),biggest.apply(biggest.solved,{axis:'X',layer:99,turns:1}));
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);console.log('PASS: actual intermediate net frames synchronized with DOM/canvas 3D, pause and undo, reset during motion, automatic affected-face following, 200-layer animation and mobile layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
