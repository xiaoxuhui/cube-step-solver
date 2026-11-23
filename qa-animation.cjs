const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
(async()=>{
  process.env.CUBE_PORT='4320';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4320');
    const setSpeed=value=>page.locator('#run-speed').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input'));},String(value));
    const current=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cube-step-v1'));return s.stickers.map(c=>c==='k'?'*':CubeCore.faces[s.centers.indexOf(c)]).join('');});
    async function size(dims){for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));await page.locator('#apply-size').click();}
    await page.evaluate(()=>{
      const original=LargeCubeView.prototype.renderScene;
      window.motionFrames=[];window.middleFrame=null;
      LargeCubeView.prototype.renderScene=function(args){original.call(this,args);if(args.rotation){window.motionFrames.push({axis:args.rotation.axis,angle:args.rotation.angle,time:performance.now()});if(!window.middleFrame&&Math.abs(args.rotation.angle)>25&&Math.abs(args.rotation.angle)<65)window.middleFrame=document.getElementById('large-preview').toDataURL();}};
    });
    const model=new CuboidModel([13,13,13]);
    for(const axis of ['X','Y','Z']){
      await size([13,13,13]);await setSpeed(1);await page.locator('#animation-enabled').check();
      await page.locator('details.manual').evaluate(el=>el.open=true);await page.locator('#manual-axis').selectOption(axis);await page.locator('#manual-layer').selectOption('6');await page.locator('#manual-turn').selectOption('');
      await page.evaluate(()=>{window.motionFrames=[];window.middleFrame=null;});
      await page.locator('#manual-apply').click();await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);
      const frames=await page.evaluate(()=>window.motionFrames);assert(frames.length>=3);assert(frames.some(f=>Math.abs(f.angle)>5&&Math.abs(f.angle)<85));
      assert.equal(await current(),model.apply(model.solved,{axis,layer:6,turns:1}));
      if(axis==='Z'){const data=await page.evaluate(()=>window.middleFrame);assert(data);fs.writeFileSync('animation-mid-turn.png',Buffer.from(data.split(',')[1],'base64'));}
    }
    // A single-turn solve checks autoplay, dragging during animation and pending reset.
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
    const before=await current();await page.evaluate(()=>window.motionFrames=[]);await page.locator('#run').click();await page.waitForFunction(()=>window.motionFrames.some(f=>Math.abs(f.angle)>5));
    await page.locator('#home-view').click();await page.locator('#reset-run').click();await page.waitForFunction(()=>document.getElementById('step-count').textContent.startsWith('0 /')&&!document.getElementById('next').disabled);
    assert.equal(await current(),before);await page.waitForTimeout(200);assert.equal(await current(),before);
    await setSpeed(8);await page.evaluate(()=>window.motionFrames=[]);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');assert.equal(await current(),model.solved);
    const fast=await page.evaluate(()=>window.motionFrames);assert(fast.some(f=>Math.abs(f.angle)>0&&Math.abs(f.angle)<90));assert(fast.at(-1).time-fast[0].time<500);
    await page.locator('#reset-run').click();await page.locator('#animation-enabled').uncheck();await page.evaluate(()=>window.motionFrames=[]);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');assert.equal(await page.evaluate(()=>window.motionFrames.length),0);
    await page.reload();assert.equal(await page.locator('#animation-enabled').isChecked(),false);
    // Hundred-layer preview must animate a real interior layer too.
    await size([100,100,100]);await setSpeed(2);await page.locator('#animation-enabled').check();await page.locator('details.manual').evaluate(el=>el.open=true);await page.locator('#manual-axis').selectOption('X');await page.locator('#manual-layer').selectOption('49');
    await page.evaluate(()=>{
      window.hundredFrames=[];const original=LargeCubeView.prototype.renderScene;LargeCubeView.prototype.renderScene=function(args){original.call(this,args);if(args.rotation)window.hundredFrames.push(args.rotation.angle);};
    });
    const bigBefore=await current();await page.locator('#manual-apply').click();await page.waitForFunction(()=>!document.getElementById('manual-apply').disabled);
    assert((await page.evaluate(()=>window.hundredFrames)).some(a=>Math.abs(a)>0&&Math.abs(a)<90));assert.notEqual(await current(),bigBefore);
    const hundred=new CuboidModel([100,100,100]);assert.equal(await current(),hundred.apply(bigBefore,{axis:'X',layer:49,turns:1}));
    assert.deepEqual(errors,[]);console.log('PASS: real intermediate canvas rotations on X/Y/Z; correct final states, animation-speed timing, autoplay, view change, reset during animation, toggle persistence, and a 100x100x100 interior layer.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
