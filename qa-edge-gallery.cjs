const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  process.env.CUBE_PORT='4323';const server=require('./server.cjs');await new Promise(r=>server.once('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server']});
  try{
    const page=await browser.newPage({viewport:{width:1050,height:760}});await page.goto('http://127.0.0.1:4323');
    await page.evaluate(()=>{
      document.body.innerHTML='<main style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;max-width:none" id="gallery"></main>';
      const colors={w:{hex:'#f3f4ef'},r:{hex:'#ef5966'},g:{hex:'#43c99a'},y:{hex:'#f3d358'},o:{hex:'#f6984c'},b:{hex:'#508aeb'}};
      for(const n of [8,13,25,49,100,200]){
        const card=document.createElement('section');card.style.cssText='border:1px solid #364258;border-radius:12px;padding:10px';
        const label=document.createElement('p');label.textContent=n+' × '+n+' × '+n;label.style.margin='0';const scene=document.createElement('div');scene.style.cssText='height:290px;position:relative';const cube=document.createElement('div');scene.append(cube);card.append(label,scene);document.getElementById('gallery').append(card);
        const model=new Cuboid.CuboidModel([n,n,n]),palette=['w','r','g','y','o','b'],stickers=model.cells.map(g=>palette[['U','R','F','D','L','B'].indexOf(g.face)]);
        new LargeCubeView().renderScene({scene,cube,model,stickers,colors,view:{x:-25,y:-35,z:0,scale:1}});
      }
    });
    await page.screenshot({path:process.argv[2]||'edge-gallery.png',fullPage:true});console.log('Saved edge gallery.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
