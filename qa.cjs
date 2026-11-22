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
    async function applySize(dims){
      for(let i=0;i<3;i++)await page.locator('#size-'+['x','y','z'][i]).fill(String(dims[i]));
      await page.locator('#apply-size').click();
      assert.equal(await page.locator('.sticker').count(),2*(dims[0]*dims[1]+dims[0]*dims[2]+dims[1]*dims[2]));
    }
    const blackCount=async()=>[...(await currentPattern())].filter(c=>c==='*').length;
    await page.locator('#demo').click();
    const unmasked=await currentPattern();
    await page.locator('#black-percent').fill('0');await page.locator('#random-black').click();assert.equal(await currentPattern(),unmasked);
    await page.locator('#black-percent').fill('50');await page.locator('#random-black').click();assert.equal(await blackCount(),24);
    await page.locator('#black-percent').fill('100');await page.locator('#random-black').click();assert.equal(await blackCount(),48);
    assert.equal(await page.locator('.center:disabled').count(),6,'classic fixed centers survive random masking');
    await page.locator('#black-percent').fill('101');await page.locator('#random-black').click();assert.match(await page.locator('#status').innerText(),/0 到 100/);
    await page.locator('#size-x').fill('0');await page.locator('#apply-size').click();assert.match(await page.locator('#status').innerText(),/1 到 7/);assert.equal(await page.locator('.sticker').count(),54);
    await applySize([2,3,4]);
    assert.equal(await page.locator('[data-face="U"] .sticker').count(),8);
    assert.equal(await page.locator('[data-face="R"] .sticker').count(),12);
    assert.equal(await page.locator('[data-face="F"] .sticker').count(),6);
    await page.locator('#demo').click();await page.locator('#black-percent').fill('50');await page.locator('#random-black').click();assert.equal(await blackCount(),26);
    await page.locator('.manual summary').click();await page.locator('#manual-axis').selectOption('X');
    assert.equal(await page.locator('#manual-turn').inputValue(),'2');
    assert.equal(await page.locator('#manual-turn option:disabled').count(),2);
    const cuboidStart=await currentPattern();
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#next').click();await page.waitForFunction(()=>!document.getElementById('prev').disabled);
    assert.equal(await blackCount(),26);
    await page.locator('#prev').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await currentPattern(),cuboidStart);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.reload();assert.equal(await currentPattern(),cuboidStart);assert.equal(await page.locator('#size-z').inputValue(),'4');
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
    await page.setViewportSize({width:1360,height:1100});await page.screenshot({path:'desktop-preview.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile-preview.png',fullPage:true});
    let cuboidSteps=0;while(await page.locator('#next').isEnabled()){await page.locator('#next').click();if(++cuboidSteps>40)throw Error('cuboid must restore from recorded scramble');}
    assert.match(await page.locator('#status').innerText(),/所有非黑色格子都已归位/);
    assert(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cube-step-v1'));const m=new Cuboid.CuboidModel(s.dimensions);return m.isSolved(s.stickers.map(c=>c==='k'?'*':CubeCore.faces[s.centers.indexOf(c)]).join(''));}));
    await applySize([4,4,4]);await page.locator('#demo').click();
    await page.locator('.manual summary').click();await page.locator('#manual-axis').selectOption('X');await page.locator('#manual-layer').selectOption('1');await page.locator('#manual-turn').selectOption('');await page.locator('#manual-apply').click();
    await page.locator('#black-percent').fill('25');await page.locator('#random-black').click();assert.equal(await blackCount(),24);
    await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
    let bigSteps=0;while(await page.locator('#next').isEnabled()){await page.locator('#next').click();if(++bigSteps>40)throw Error('4x4 restoration must finish');}
    assert.match(await page.locator('#status').innerText(),/还原完成/);
    // A 2x2 input without provenance must use the independent color solver.
    const {CuboidModel}=require('./dist/cuboid');const pocket=new CuboidModel([2,2,2]);const pocketText=pocket.scramble().state;
    await page.evaluate(({text,centerColors,faces})=>localStorage.setItem('cube-step-v1',JSON.stringify({dimensions:[2,2,2],centers:centerColors,stickers:[...text].map(c=>centerColors[faces.indexOf(c)])})),{text:pocketText,centerColors,faces});
    await page.reload();await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled,{},{timeout:30000});
    let pocketSteps=0;while(await page.locator('#next').isEnabled()){await page.locator('#next').click();if(++pocketSteps>32)throw Error('2x2 must solve from colors');}
    assert.match(await page.locator('#status').innerText(),/还原完成/);
    await applySize([7,7,7]);assert.equal(await page.locator('.tile').count(),294);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'largest dimension must scroll inside net without page overflow');
    await page.evaluate(()=>{let seed=19761;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
    const sevenLengths=[];
    for(let i=0;i<4;i++){
      await page.locator('#demo').click();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')));
      assert(data.scrambleCount>=28&&data.scrambleCount<=56);assert.equal(data.history.length,data.scrambleCount);sevenLengths.push(data.scrambleCount);
      assert.match(await page.locator('#scramble-info').innerText(),new RegExp('随机打乱 '+data.scrambleCount+' 步'));
      await page.locator('#black-percent').fill('40');await page.locator('#random-black').click();
      await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
      const count=await page.locator('#step-count').innerText();assert(Number(count.split('/')[1])<=data.scrambleCount);
      if(i===3){
        await page.reload();assert.match(await page.locator('#scramble-info').innerText(),new RegExp('随机打乱 '+data.scrambleCount+' 步'));
        await page.locator('#solve').click();await page.waitForFunction(()=>!document.getElementById('next').disabled);
        let steps=0;while(await page.locator('#next').isEnabled()){await page.locator('#next').click();if(++steps>56)throw Error('random-length seven must restore');}
        assert.match(await page.locator('#status').innerText(),/还原完成/);
      }
    }
    assert(new Set(sevenLengths).size>1,'7x7 browser scramble lengths must vary');
    assert.deepEqual(errors,[]);
    console.log('PASS: browser worker solve, one-step execution, undo, complete restoration, manual axis rotation, mobile layout, input validation and persistence.');
    console.log('PASS: black brush, ignore-unfilled, zero-step masked goal, one-step partial worker, real animation and undo, complex masked worker solve, mask persistence and seven-color mobile layout.');
    console.log('PASS: size fields and invalid values, exact random black percentages, fixed centers, 2x3x4 layer constraints and animated undo, history across reload, 4x4 inner slices, independent 2x2 color solving and 7x7 mobile layout.');
    console.log('PASS: 7x7 random lengths '+sevenLengths.join(', ')+', visible count, reload persistence and masked restoration.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
