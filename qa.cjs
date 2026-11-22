const assert=require('node:assert/strict');
const Cube=require('./dist/vendor/cube');
const {faces,applyMove}=require('./dist/core');
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
    await page.locator('.manual summary').click();
    await page.locator('#manual-axis').selectOption('Z');
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
    // Exercise the actual black brush and the all-ignored zero-step goal.
    await page.locator('#clear').click();
    await page.getByRole('button',{name:'黑色，已填 0 格',exact:true}).click();
    await page.getByRole('button',{name:'上面 1行 1列，未填',exact:true}).click();
    await page.locator('#mask-empty').click();
    assert.equal(await page.locator('.paint-count.over').count(),0);
    await page.locator('#solve').click();
    assert.match(await page.locator('#status').innerText(),/非黑色格子已经还原/);
    assert.equal(await page.locator('#step-count').innerText(),'0 / 0');
    assert.equal(await page.locator('#centers option[value="k"]').count(),0);
    const centerColors=['w','r','g','y','o','b'];
    async function loadPattern(text){
      await page.evaluate(({text,centerColors,faces})=>localStorage.setItem('cube-step-v1',JSON.stringify({centers:centerColors,stickers:[...text].map(c=>c==='*'?'k':centerColors[faces.indexOf(c)])})),{text,centerColors,faces});
      await page.reload();
    }
    async function currentPattern(){return page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('cube-step-v1'));return v.stickers.map(c=>c==='k'?'*':CubeCore.faces[v.centers.indexOf(c)]).join('');});}
    const partial=[...new Cube().asString()].map((c,i)=>i%9===4||i%5===0?c:'*').join('');
    const oneTurn=applyMove(partial,'R');await loadPattern(oneTurn);
    await page.locator('#solve').click();
    await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    assert.equal(await page.locator('#step-count').innerText(),'0 / 1');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#next').click();
    await page.waitForFunction(()=>document.getElementById('instruction-title').textContent==='非黑色格子已归位');
    assert.equal(await currentPattern(),partial);
    await page.locator('#prev').click();
    await page.waitForFunction(()=>!document.getElementById('next').disabled);
    assert.equal(await currentPattern(),oneTurn,'animated undo must retain the exact black mask');
    await page.emulateMedia({reducedMotion:'reduce'});
    // A complex masked state exercises completion and the two-phase fallback worker.
    const complex=[...new Cube().move("R U2 F L' B D R2 F' U B2 L D'").asString()].map((c,i)=>i%9!==4&&i%3===0?'*':c).join('');
    await loadPattern(complex);await page.locator('#solve').click();
    await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    await page.setViewportSize({width:1360,height:1100});
    await page.screenshot({path:'desktop-preview.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'mobile-preview.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'seven-color mobile palette must not overflow');
    let blackSteps=0;while(await page.locator('#next').isEnabled()){
      await page.locator('#next').click();if(++blackSteps>40)throw Error('partial plan failed to finish');
      assert.equal([...(await currentPattern())].filter(c=>c==='*').length,[...complex].filter(c=>c==='*').length);
    }
    assert.match(await page.locator('#status').innerText(),/所有非黑色格子都已归位/);
    const restored=await currentPattern();assert([...restored].every((c,i)=>c==='*'||c===faces[Math.floor(i/9)]));
    await page.reload();assert.equal(await currentPattern(),restored);
    assert.deepEqual(errors,[]);
    console.log('PASS: browser worker solve, one-step execution, undo, complete restoration, manual axis rotation, mobile layout, input validation and persistence.');
    console.log('PASS: black brush, ignore-unfilled, zero-step masked goal, one-step partial worker, real animation and undo, complex masked worker solve, mask persistence and seven-color mobile layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
