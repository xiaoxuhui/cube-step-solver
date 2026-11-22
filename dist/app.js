(() => {
  const {faces,names,turns,geometry,describe,validatePattern,isPatternSolved,applyMove}=CubeCore;
  const colors={w:{name:'白',hex:'#f3f4ef'},r:{name:'红',hex:'#ef5966'},g:{name:'绿',hex:'#43c99a'},y:{name:'黄',hex:'#f3d358'},o:{name:'橙',hex:'#f6984c'},b:{name:'蓝',hex:'#508aeb'},k:{name:'黑',hex:'#07090e'}};
  let centers=['w','r','g','y','o','b'],stickers=faces.flatMap((_,i)=>Array(9).fill(centers[i])),selected='w';
  let moves=[],cursor=0,hasPlan=false,busy=false,animating=false,worker=null,job=0,timer=null;
  let view={x:-25,y:-35,z:0,scale:1};
  const $=id=>document.getElementById(id),cubeEl=$('cube'),net=$('net');
  const status=(text,kind='')=>{$('status').textContent=text;$('status').className='status '+kind;};
  const faceColor=face=>centers[faces.indexOf(face)];
  function encoded(){return stickers.map(c=>{if(c==='k')return '*';const i=centers.indexOf(c);return i<0?'?':faces[i];}).join('');}
  function fromPattern(text){stickers=[...text].map(c=>c==='*'?'k':faceColor(c));}
  function fromCube(c){stickers=[...c.asString()].map(faceColor);}
  function save(){try{localStorage.setItem('cube-step-v1',JSON.stringify({centers,stickers}));}catch{}}
  try{const v=JSON.parse(localStorage.getItem('cube-step-v1'));if(v&&v.centers?.length===6&&new Set(v.centers).size===6&&v.centers.every(c=>colors[c]&&c!=='k')&&v.stickers?.length===54&&v.stickers.every(c=>c===null||colors[c])&&faces.every((_,i)=>v.stickers[i*9+4]===v.centers[i])){centers=v.centers;stickers=v.stickers;}}catch{}
  function invalidate(){moves=[];cursor=0;hasPlan=false;updateSteps();}
  function renderPalette(){
    $('palette').replaceChildren();
    for(const [key,color]of Object.entries(colors)){
      const count=stickers.filter(c=>c===key).length,b=document.createElement('button');
      b.className='paint';b.setAttribute('aria-pressed',String(selected===key));b.setAttribute('aria-label',`${color.name}色，已填 ${count} 格`);
      b.innerHTML=`<span class="paint-swatch" style="background:${color.hex}"></span><span>${color.name}</span><span class="paint-count ${key!=='k'&&count>9?'over':''}">${key==='k'?count+' 忽略':count+' / 9'}</span>`;
      b.disabled=busy||animating;b.onclick=()=>{selected=key;renderPalette();};$('palette').append(b);
    }
  }
  function renderNet(){
    net.replaceChildren();
    faces.forEach((face,fi)=>{
      const wrap=document.createElement('div');wrap.className='face';wrap.dataset.face=face;
      const title=document.createElement('div');title.className='face-title';title.textContent=`${names[face]} ${face}`;
      const grid=document.createElement('div');grid.className='face-grid';
      for(let j=0;j<9;j++){
        const i=fi*9+j,c=stickers[i],b=document.createElement('button');b.className='sticker'+(j===4?' center':'');b.style.background=colors[c]?.hex||'#323d50';
        b.setAttribute('aria-label',`${names[face]}面 ${Math.floor(j/3)+1}行 ${j%3+1}列，${colors[c]?.name||'未填'}${j===4?'，中心固定':''}`);
        b.disabled=j===4||busy||animating;if(j===4)b.textContent=face;
        b.onclick=()=>{stickers[i]=selected;invalidate();status('填色已更新，完成后可以重新计算。');renderAll();};grid.append(b);
      }
      wrap.append(title,grid);net.append(wrap);
    });
  }
  function renderCube(){
    cubeEl.replaceChildren();
    faces.forEach((face,fi)=>{for(let j=0;j<9;j++){
      const g=geometry(face,j),p=g.p.map((v,i)=>(v+g.n[i]*.5)*60),el=document.createElement('div');
      el.className='tile';el.style.background=colors[stickers[fi*9+j]]?.hex||'#323d50';el.style.transform=`translate3d(${p[0]}px,${-p[1]}px,${p[2]}px) ${g.rot}`;
      el.dataset.face=face;el.dataset.index=j;if(j===4)el.textContent=face;cubeEl.append(el);
    }});applyView();
  }
  function applyView(){cubeEl.style.transform=`rotateX(${view.x}deg) rotateY(${view.y}deg) rotateZ(${view.z}deg) scale(${view.scale})`;}
  function updateSteps(){
    const complete=hasPlan&&cursor===moves.length;
    $('step-label').textContent=hasPlan?(complete?'还原完成':`下一步 · 第 ${cursor+1} 步`):'等待计算';
    $('step-count').textContent=`${cursor} / ${moves.length}`;
    $('move-token').textContent=complete?'✓':hasPlan?moves[cursor]:'—';
    const info=hasPlan&&!complete?describe(moves[cursor]):null;
    $('instruction-title').textContent=info?.title||(complete?(stickers.includes('k')?'非黑色格子已归位':'六面已经归位'):'准备好你的魔方');
    $('instruction-detail').textContent=info?.detail||(complete?(stickers.includes('k')?'黑色格子不参与完成判断。你可以返回上一步复习。':'已完成全部步骤。你可以返回上一步复习。'):'填写六面颜色后，点击“计算还原步骤”。');
    const percent=hasPlan?(moves.length?cursor/moves.length*100:100):0;
    $('progress-fill').style.width=percent+'%';document.querySelector('.progress').setAttribute('aria-valuenow',String(Math.round(percent)));
    $('prev').disabled=!hasPlan||cursor===0||busy||animating;
    $('next').disabled=!hasPlan||complete||busy||animating;
    $('next').textContent=complete?'已完成还原':animating?'正在转动…':'执行下一步';
    for(const id of ['solve','demo','clear','mask-empty','manual-apply','manual-axis','manual-layer','manual-turn'])$(id).disabled=busy||animating;
    $('solve').textContent=busy?'正在计算…':'计算还原步骤';
    document.querySelectorAll('#centers select').forEach(el=>el.disabled=busy||animating);
  }
  function renderAll(){renderPalette();renderNet();renderCube();updateSteps();save();}
  function renderCenters(){
    $('centers').replaceChildren();faces.forEach((face,i)=>{
      const label=document.createElement('label');label.textContent=`${names[face]}面 ${face}`;const sel=document.createElement('select');sel.setAttribute('aria-label',`${names[face]}面中心颜色`);
      Object.entries(colors).filter(([k])=>k!=='k').forEach(([k,v])=>{const opt=document.createElement('option');opt.value=k;opt.textContent=v.name;sel.append(opt);});sel.value=centers[i];
      sel.onchange=()=>{const old=centers[i],other=centers.indexOf(sel.value),next=sel.value;centers[i]=next;centers[other]=old;stickers=stickers.map(c=>c===old?next:c===next?old:c);invalidate();renderCenters();renderAll();status('中心配色已调整；请对照实物检查其余方格。');};label.append(sel);$('centers').append(label);
    });
  }
  $('demo').onclick=()=>{const c=new Cube();let last='';for(let i=0;i<22;i++){let f;do{f=faces[Math.floor(Math.random()*6)];}while(f===last);last=f;c.move(f+['',"'",'2'][Math.floor(Math.random()*3)]);}fromCube(c);invalidate();renderAll();status('已生成合法的随机魔方，点击“计算还原步骤”开始。');};
  $('clear').onclick=()=>{stickers=Array(54).fill(null);faces.forEach((_,i)=>stickers[i*9+4]=centers[i]);invalidate();renderAll();status('已保留六个中心。请选择画笔，填写其他 48 格。');};
  $('mask-empty').onclick=()=>{stickers=stickers.map(c=>c===null?'k':c);invalidate();renderAll();status('未填格已涂黑；计算时只要求非黑色格子归位。');};
  function finishSolve(){clearTimeout(timer);timer=null;busy=false;renderPalette();renderNet();updateSteps();}
  function workerError(message){finishSolve();worker?.terminate();worker=null;status(message,'error');}
  $('solve').onclick=()=>{
    try{validatePattern(encoded(),Cube);}catch(e){status(e.message,'error');return;}
    invalidate();if(isPatternSolved(encoded())){hasPlan=true;updateSteps();status(stickers.includes('k')?'非黑色格子已经还原，黑色格子忽略，不需要转动。':'这个魔方已经还原，不需要转动。','success');return;}
    if(location.protocol==='file:'){status('请通过本地启动器或网站打开，浏览器直接打开文件不支持后台求解。','error');return;}
    busy=true;renderPalette();renderNet();updateSteps();status('正在计算还原步骤…');const id=++job;
    try{
      if(!worker){worker=new Worker('solver-worker.js?v=black1');worker.onmessage=({data})=>{
        if(data.id!==job)return;
        if(data.kind==='progress'){status(data.message);return;}
        if(data.kind==='error'){workerError(data.message);return;}
        moves=data.moves;cursor=0;hasPlan=true;finishSolve();status(`找到 ${moves.length} 步还原方案。每点一次“执行下一步”，只进行一次转动。`,'success');
      };worker.onerror=()=>workerError('求解器加载失败，请刷新后重试。');}
      timer=setTimeout(()=>workerError('计算超时，请重新核对输入后再试。'),90000);worker.postMessage({id,text:encoded()});
    }catch{workerError('浏览器无法启动求解器，请通过现代浏览器打开网站。');}
  };
  async function animateMove(move){
    const text=encoded(),info=describe(move);animating=true;renderPalette();renderNet();updateSteps();
    const group=document.createElement('div');group.className='turn-layer';cubeEl.append(group);const ai={X:0,Y:1,Z:2}[info.axis];
    for(const el of [...cubeEl.querySelectorAll('.tile')])if(geometry(el.dataset.face,Number(el.dataset.index)).p[ai]===info.layer)group.append(el);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const animation=group.animate([{transform:`rotate${info.axis}(0deg)`},{transform:`rotate${info.axis}(${info.css*info.amount}deg)`}],{duration:Math.abs(info.amount)===2?650:450,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      await animation.finished;
    }
    fromPattern(applyMove(text,move));animating=false;
  }
  $('next').onclick=async()=>{if(animating||busy||!hasPlan||cursor>=moves.length)return;await animateMove(moves[cursor]);cursor++;renderAll();if(cursor===moves.length)status(stickers.includes('k')?'还原完成！所有非黑色格子都已归位，黑色格子忽略。':'还原完成！六个面都已同色。','success');};
  $('prev').onclick=async()=>{if(animating||busy||!hasPlan||cursor===0)return;await animateMove(Cube.inverse(moves[cursor-1]));cursor--;renderAll();status('已返回上一步，可以再次执行。');};
  $('manual-apply').onclick=async()=>{
    try{validatePattern(encoded(),Cube);}catch(e){status(e.message,'error');return;}
    const axis=$('manual-axis').value,layer=Number($('manual-layer').value),face=faces.find(f=>turns[f].axis===axis&&turns[f].layer===layer),move=face+$('manual-turn').value;
    invalidate();await animateMove(move);renderAll();status(`已执行 ${describe(move).title}。可以重新计算还原方案。`);
  };
  $('home-view').onclick=()=>{view={x:-25,y:-35,z:0,scale:1};applyView();};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view[b.dataset.view.toLowerCase()]+=90;applyView();});
  let pointer=null;$('scene').onpointerdown=e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('scene').setPointerCapture(e.pointerId);};
  $('scene').onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;view.y+=(e.clientX-pointer.x)*.5;view.x-=(e.clientY-pointer.y)*.5;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};applyView();};
  $('scene').onpointerup=$('scene').onpointercancel=()=>pointer=null;
  $('scene').addEventListener('wheel',e=>{e.preventDefault();view.scale=Math.max(.65,Math.min(1.3,view.scale-e.deltaY*.001));applyView();},{passive:false});
  renderCenters();renderAll();
})();
