const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {CuboidModel}=require('./dist/cuboid');
(async()=>{
  process.env.CUBE_PORT='4325';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4325');
    const fixture=dims=>{
      const model=new CuboidModel(dims),n=dims[0],history=[{axis:'X',layer:0,turns:1},{axis:'X',layer:Math.floor(n/2),turns:-1},{axis:'X',layer:n-1,turns:2},{axis:'Y',layer:1,turns:1},{axis:'Y',layer:n-2,turns:2},{axis:'Z',layer:0,turns:-1},{axis:'Z',layer:Math.floor(n/2),turns:1},{axis:'Z',layer:n-1,turns:2}];
      const full=history.reduce((s,m)=>model.apply(s,m),model.solved),text=[...full].map((c,i)=>i%19===0?'*':c).join('');return {model,history,text};
    };
    async function load(f){
      await page.evaluate(({dims,text,history})=>{const faces=['U','R','F','D','L','B'],centers=['w','r','g','y','o','b'];localStorage.setItem('cube-step-v1',JSON.stringify({dimensions:dims,centers,stickers:[...text].map(c=>c==='*'?'k':centers[faces.indexOf(c)]),history,animationEnabled:true,speed:1}));},{dims:f.model.dims,text:f.text,history:f.history});await page.reload();
      await page.evaluate(()=>{
        window.solutions=[];const Original=window.Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.kind==='result')window.solutions.push(e.data);});}};
        window.parallelFrames=[];window.rotationFrames=[];
        const frame=NetMotion.NetTurnView.prototype.frame;NetMotion.NetTurnView.prototype.frame=function(t){frame.call(this,t);window.parallelFrames.push({t,layers:this.session.plan.moves.map(m=>m.layer),groups:[...document.querySelectorAll('.turn-layer')].map(g=>({layer:Number(g.dataset.layer),transform:g.style.transform}))});};
        const render=LargeCubeView.prototype.renderScene;LargeCubeView.prototype.renderScene=function(args){render.call(this,args);if(Array.isArray(args.rotation))window.rotationFrames.push(args.rotation.map(r=>({...r})));};
      });
    }
    const pattern=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cube-step-v1'));return s.stickers.map(c=>c==='k'?'*':CubeCore.faces[s.centers.indexOf(c)]).join('');});
    const speed=value=>page.locator('#run-speed').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input'));},String(value));
    const first=fixture([7,7,7]);await load(first);await page.locator('#solve-parallel').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    assert(await page.locator('#parallel-enabled').isChecked());assert.equal(await page.locator('#prev').innerText(),'上一组');assert.equal(await page.locator('#next').innerText(),'执行下一组');assert.match(await page.locator('#speed-value').innerText(),/组\/秒/);
    const result=await page.evaluate(()=>window.solutions.at(-1)),expected=first.model.parallelGroups(result.moves);assert.deepEqual(result.groups,expected);assert(expected[0].length>1);assert(expected.length<result.moves.length);
    const start=await pattern();await page.locator('#next').click();await page.waitForFunction(()=>window.parallelFrames.some(f=>f.t>.1&&f.t<.9),{},{polling:10});
    assert.equal(await page.locator('.turn-layer').count(),expected[0].length);await page.screenshot({path:'parallel-mid-turn.png',fullPage:true});await page.waitForFunction(()=>!document.getElementById('prev').disabled);
    assert.equal(await pattern(),first.model.applyGroup(start,expected[0]));await page.locator('#prev').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await pattern(),start);
    await page.locator('#next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);const partial=await pattern();
    await page.locator('#parallel-enabled').uncheck();assert.equal(await pattern(),partial,'turning off parallel must retain the actual state');assert.equal(await page.locator('#next').innerText(),'执行下一步');
    await page.locator('#next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);await page.locator('#prev').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await pattern(),partial);
    await page.locator('#parallel-enabled').check();assert.equal(await pattern(),partial);await page.locator('#reset-run').click();assert.equal(await pattern(),start);
    await page.locator('#net-run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='正在转动…');assert(await page.locator('#parallel-enabled').isDisabled());await page.locator('#net-reset').click();await page.waitForFunction(()=>document.getElementById('step-count').textContent.startsWith('0 /')&&!document.getElementById('next').disabled);assert.equal(await pattern(),start);
    await page.locator('#animation-enabled').uncheck();await speed(120);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');assert(first.model.isSolved(await pattern()));
    await page.locator('#reset-run').click();assert.equal(await pattern(),start);await page.reload();assert(await page.locator('#parallel-enabled').isChecked());
    console.log('PASS: actual parallel solver groups, multiple DOM layers at once, whole-group previous/next, switching mode without losing state, pause/reset and high-speed grouped restoration.');
    const large=fixture([13,13,13]);await load(large);await page.locator('.face-tabs button[data-face="R"]').click();await page.locator('#solve-parallel').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    const largeResult=await page.evaluate(()=>window.solutions.at(-1));await page.locator('#next').click();await page.waitForFunction(()=>window.rotationFrames.some(g=>g.length>1&&g.some(r=>Math.abs(r.angle)>0)),{},{polling:10});await page.waitForFunction(()=>!document.getElementById('prev').disabled);
    assert.equal(await pattern(),large.model.applyGroup(large.text,largeResult.groups[0]));assert((await page.evaluate(()=>window.parallelFrames)).some(f=>f.layers.length>1&&f.t>0&&f.t<1));
    await page.locator('#prev').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await pattern(),large.text);
    await page.locator('#animation-enabled').uncheck();await speed(120);await page.locator('#run').click();await page.waitForFunction(()=>document.getElementById('next').textContent==='已完成还原');assert(large.model.isSolved(await pattern()));
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'parallel-mobile-preview.png',fullPage:true});assert.deepEqual(errors,[]);
    console.log('PASS: multiple canvas layers and unfolded face strips animate together; full grouped solve, undo, persisted option and mobile layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
