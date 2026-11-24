const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  process.env.CUBE_PORT='4324';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4324');
    const results=await page.evaluate(()=>{
      document.body.innerHTML='<div id="test-scene" style="width:500px;height:500px;position:relative"><div id="test-cube"></div></div>';
      const colors={g:{hex:'#43c99a'},r:{hex:'#ef5966'},b:{hex:'#508aeb'}},palette=['g','r','b'],out=[];
      const scene=document.getElementById('test-scene'),cube=document.getElementById('test-cube');
      for(const n of [13,25,49,100,200]){
        const model=new Cuboid.CuboidModel([n,n,n]),stickers=model.cells.map(cell=>palette[cell.col%3]),view=new LargeCubeView();view.renderScene({scene,cube,model,stickers,colors,view:{x:0,y:0,z:0,scale:1}});
        const texture=view.textures.get('F'),ctx=texture.image.getContext('2d'),sampleCols=[0,1,n-2,n-1];
        for(const col of sampleCols){const p=ctx.getImageData(Math.floor((col+.5)*texture.unit),Math.floor(Math.floor(n/2)*texture.unit+texture.unit/2),1,1).data,expected=colors[palette[col%3]].hex;const rgb=[1,3,5].map(i=>parseInt(expected.slice(i,i+2),16));if(rgb.some((v,i)=>Math.abs(v-p[i])>20))throw Error('edge sticker texture differs from its real color at '+n+':'+col);}
        if(n===25){
          const canvas=scene.querySelector('canvas'),paint=canvas.getContext('2d');
          // The front face projects from x=150 to 350, with exactly 25 equal-width cells.
          for(let col=0;col<n;col++)for(const fraction of [.25,.5,.75]){
            const x=150+(col+fraction)*200/n,p=paint.getImageData(Math.round(x*2),Math.round(240*2),1,1).data,rgb=[1,3,5].map(i=>parseInt(colors[palette[col%3]].hex.slice(i,i+2),16));
            if(rgb.some((v,i)=>Math.abs(v-p[i])>35))throw Error('visible grid edge was squashed or column count incorrect at '+col+':'+fraction);
          }
        }
        if(scene.querySelector('canvas').width!==1000)throw Error('high-DPI preview resolution not used');
        const changed=model.offsets.F;stickers[changed]=palette[1];view.renderScene({scene,cube,model,stickers,colors,view:{x:0,y:0,z:0,scale:1},refreshTextures:true});
        const refreshed=view.textures.get('F'),updated=refreshed.image.getContext('2d').getImageData(Math.floor(refreshed.unit/2),Math.floor(refreshed.unit/2),1,1).data;
        if(Math.abs(updated[0]-239)>20||Math.abs(updated[1]-89)>20)throw Error('manual paint must invalidate cached face textures');
        out.push({size:n,faceColumns:model.shapes.F[1],textureUnit:texture.unit});
      }
      return out;
    });
    assert.equal(results.length,5);assert.deepEqual(errors,[]);console.log('PASS: real first/last edge colors for 13/25/49/100/200, all 25 projected columns keep their correct widths, and high-DPI rendering.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
