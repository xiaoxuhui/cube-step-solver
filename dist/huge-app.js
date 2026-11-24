(() => {
  const {HugeCubeModel,MAX_DIMENSION,dimensions,count,faces,axes}=HugeCube;
  const names={U:'上',R:'右',F:'前',D:'下',L:'左',B:'后'},paintNames={w:'白',r:'红',g:'绿',y:'黄',o:'橙',b:'蓝'},hex={w:'#f3f4ef',r:'#ef5966',g:'#43c99a',y:'#f3d358',o:'#f6984c',b:'#508aeb','*':'#07090e','?':'#323d50'};
  const fmt=n=>n.toLocaleString('zh-CN'),$=id=>document.getElementById('huge-'+id);
  let model=null,root=null,centers=['w','r','g','y','o','b'],selected='F',face='F',row=0,col=0,plan=null,cursor=0,start=null,playing=false,animating=false,epoch=0,resetPending=false,scrambleCount=null,view={x:-25,y:-35},sampleRevision=-1,sampleCache=new Map(),prefs={parallel:false,speed:4,animation:true};
  const normal=()=>document.querySelector('.workspace');
  function note(text,error=false){$('status').textContent=text;$('status').className='status'+(error?' error':'');}
  function save(){if(!model)return;try{localStorage.setItem('cube-huge-v1',JSON.stringify({state:model.snapshot(),centers,prefs,scrambleCount,face,row,col}));localStorage.setItem('cube-huge-active','1');}catch{note('浏览器存储空间不足。当前状态仍可使用，刷新前请先完成操作。',true);}}
  function discard(){plan=null;start=null;cursor=0;playing=false;epoch++;}
  function color(code){return hex[centers[faces.indexOf(code)]]||hex[code];}
  function colorName(code){return code==='*'?'黑（忽略）':code==='?'?'未填':paintNames[centers[faces.indexOf(code)]];}
  function schedule(moves){return prefs.parallel?model.groups(moves):moves.map(m=>[m]);}
  function describe(group){if(!group?.length)return '';return group[0].axis+' 轴 · '+group.map(m=>`第 ${fmt(m.layer+1)} 层 ${m.turns===2?'180°':m.turns<0?'逆时针 90°':'顺时针 90°'}`).join('；');}
  function update(){
    const unit=prefs.parallel?'组':'步',locked=playing||animating,complete=plan&&cursor===plan.length;
    $('count').textContent=`${cursor} / ${plan?.length||0} ${unit}`;$('next').textContent=complete?'已完成还原':`下一${unit}`;$('prev').textContent=`上一${unit}`;
    $('instruction').textContent=animating?'正在转动…':complete?'还原完成，非黑色格子已归位':plan?describe(plan[cursor]):'生成随机魔方或手动转动，再计算还原。';
    $('prev').disabled=!plan||!cursor||locked;$('next').disabled=!plan||complete||locked;$('run').disabled=!plan||complete||animating&&!playing;$('run').textContent=playing?'暂停':'运行';$('reset').disabled=!start;
    $('progress').style.width=(plan?(plan.length?cursor/plan.length*100:100):0)+'%';$('speed-unit').textContent=unit+'/秒';
    for(const id of ['shuffle','solve','solve-parallel','parallel','manual-apply','manual-axis','manual-layer','manual-turn','paint','paint-block','apply-text','clear','mask-empty'])$(id).disabled=locked;
    for(const id of ['demo','random-black','all-black','black-percent','apply-size','size-x','size-y','size-z'])document.getElementById(id).disabled=locked;
    for(const b of root.querySelectorAll('.huge-palette button,.huge-local-grid button'))b.disabled=locked;
    $('record').textContent=`按需计算 · 保存 ${fmt(model.turns.length)} 条层转动、${fmt(model.edits.size)} 个独立填色格子。`;
  }
  function palette(){
    $('palette').replaceChildren();for(const code of [...faces,'*','?']){const button=document.createElement('button');button.className='paint';button.style.borderColor=selected===code?'#b4a0ff':'';button.setAttribute('aria-pressed',String(code===selected));button.setAttribute('aria-label',colorName(code));button.innerHTML=`<span class="paint-swatch" style="background:${color(code)}"></span><span>${colorName(code)}</span>`;button.onclick=()=>{selected=code;palette();update();};$('palette').append(button);}
  }
  function localGrid(){
    const [rows,cols]=model.shapes[face];row=Math.max(0,Math.min(rows-1,row));col=Math.max(0,Math.min(cols-1,col));
    $('row').max=rows;$('col').max=cols;$('row').value=row+1;$('col').value=col+1;
    const height=Math.min(12,rows-row),width=Math.min(12,cols-col);$('face-size').textContent=`${names[face]}面：${fmt(rows)} 行 × ${fmt(cols)} 列。当前查看第 ${fmt(row+1)}–${fmt(row+height)} 行、第 ${fmt(col+1)}–${fmt(col+width)} 列。`;
    $('grid').replaceChildren();$('grid').style.gridTemplateColumns=`repeat(${width},minmax(0,1fr))`;
    for(let r=row;r<row+height;r++)for(let c=col;c<col+width;c++){const code=model.colorAt(face,r,c),button=document.createElement('button');button.className='sticker';button.style.background=color(code);button.dataset.row=r;button.dataset.col=c;button.setAttribute('aria-label',`${names[face]}面第 ${r+1} 行第 ${c+1} 列，${colorName(code)}`);button.onclick=()=>{try{model.paint(face,r,c,selected);discard();render();note('该格填色已保存。超大尺寸手动改色后，仅能在记录可验证时求解。');}catch(e){note(e.message,true);}};$('grid').append(button);}
    for(const b of root.querySelectorAll('[data-huge-face]'))b.setAttribute('aria-pressed',String(b.dataset.hugeFace===face));
  }
  function sample(f,r,c){if(sampleRevision!==model.revision){sampleRevision=model.revision;sampleCache.clear();}const key=`${f}:${r}:${c}`;if(!sampleCache.has(key))sampleCache.set(key,model.colorAt(f,r,c));return sampleCache.get(key);}
  function draw(group=null,t=0){
    const canvas=$('canvas'),rect=canvas.getBoundingClientRect(),width=rect.width||500,height=330,dpr=Math.min(2,devicePixelRatio||1);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==height*dpr){canvas.width=Math.round(width*dpr);canvas.height=height*dpr;}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const scale=Math.min(width*.29,115)/Math.max(...model.dims),ax=view.x*Math.PI/180,ay=view.y*Math.PI/180;
    function transform(p){const x=p[0]*Math.cos(ay)+p[2]*Math.sin(ay),z=-p[0]*Math.sin(ay)+p[2]*Math.cos(ay);return [x,p[1]*Math.cos(ax)-z*Math.sin(ax),p[1]*Math.sin(ax)+z*Math.cos(ax)];}
    function rotate(p,axis,angle){const c=Math.cos(angle),s=Math.sin(angle),[x,y,z]=p;return axis==='X'?[x,y*c-z*s,y*s+z*c]:axis==='Y'?[x*c+z*s,y,-x*s+z*c]:[x*c-y*s,x*s+y*c,z];}
    const turning=(group||[]).map(m=>({...m,a:axes.indexOf(m.axis),coordinate:2*m.layer-model.dims[axes.indexOf(m.axis)]+1,angle:(m.axis==='Y'?-1:1)*m.turns*Math.PI/2*t})),polygons=[];
    for(const f of faces){const [rows,cols]=model.shapes[f],first=model.geometry(f,0,0),rowNext=model.geometry(f,1,0),colNext=model.geometry(f,0,1);
      const cuts=(length,delta,start)=>{const set=new Set([0,length]);for(let i=1;i<20;i++)set.add(Math.floor(length*i/20));if(delta)for(const m of turning.slice(0,64)){const at=(m.coordinate-start)/delta;if(Number.isSafeInteger(at)&&at>=0&&at<length){set.add(at);set.add(at+1);}}return [...set].sort((a,b)=>a-b);};
      const a=turning[0]?.a,rc=cuts(rows,a===undefined?0:rowNext.p[a]-first.p[a],first.p[a]),cc=cuts(cols,a===undefined?0:colNext.p[a]-first.p[a],first.p[a]);
      for(let ri=0;ri<rc.length-1;ri++)for(let ci=0;ci<cc.length-1;ci++){
        const r=rc[ri],re=rc[ri+1],c=cc[ci],ce=cc[ci+1],rr=Math.min(rows-1,r+Math.floor((re-r-1)/2)),co=Math.min(cols-1,c+Math.floor((ce-c-1)/2)),cell=model.geometry(f,rr,co),turn=turning.find(m=>cell.p[m.a]===m.coordinate),normal=[cell.n[0],-cell.n[1],cell.n[2]],n=transform(turn?rotate(normal,turn.axis,turn.angle):normal);if(n[2]<=0)continue;
        const points=[[r-.5,c-.5],[r-.5,ce-.5],[re-.5,ce-.5],[re-.5,c-.5]].map(([r0,c0])=>{const g=model.geometry(f,r0,c0),v=g.p.map((x,i)=>(x+g.n[i])*scale);v[1]*=-1;return transform(turn?rotate(v,turn.axis,turn.angle):v);});
        polygons.push({points,depth:points.reduce((s,p)=>s+p[2],0)/4,color:color(sample(f,rr,co))});
      }
    }
    polygons.sort((a,b)=>a.depth-b.depth);for(const polygon of polygons){ctx.beginPath();polygon.points.forEach((p,i)=>{const perspective=700/(700-p[2]),x=width/2+p[0]*perspective,y=height/2+p[1]*perspective;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fillStyle=polygon.color;ctx.fill();ctx.strokeStyle='#10131c';ctx.lineWidth=.5;ctx.stroke();}
  }
  function render(){localGrid();draw();palette();update();save();}
  function manualAxis(){const axis=$('manual-axis').value,a=axes.indexOf(axis);$('manual-layer').max=model.dims[a];$('manual-layer').value=Math.min(Number($('manual-layer').value)||1,model.dims[a]);for(const option of $('manual-turn').options)option.disabled=option.value!=='2'&&!model.square(axis);if(!model.square(axis))$('manual-turn').value='2';$('manual-hint').textContent=`从${{X:'左',Y:'下',Z:'后'}[axis]}侧数层号，正对${{X:'右',Y:'上',Z:'前'}[axis]}侧观察。${model.square(axis)?'允许 90° 和 180°。':'截面不是正方形，只能转 180°。'}`;}
  function generate(){try{discard();scrambleCount=model.scramble();render();note(`本次随机打乱 ${fmt(scrambleCount)} 步。记录完整，可计算还原。整体图为抽样预览，未抽样到的层也有精确记录。`);}catch(e){note(e.message,true);}}
  function randomBlack(){try{const field=document.getElementById('black-percent');if(field.value.trim()==='')throw Error('请输入涂黑比例。');model.black(Number(field.value));discard();render();note('已按指定概率随机涂黑。黑格随转动移动，不参与还原；超大尺寸不逐个统计实际黑格数。');}catch(e){note(e.message,true);}}
  function allBlack(){model.fillBlack();discard();render();note('所有格子已全部涂黑，无需转动。可按行列再填入需要还原的颜色。');}
  function solve(parallel=false){try{if(parallel){prefs.parallel=true;$('parallel').checked=true;}const moves=model.solution();start=model.snapshot();plan=schedule(moves);cursor=0;update();save();note(`已用逆置换验证 ${fmt(plan.length)} ${prefs.parallel?'组':'步'}还原记录。超大尺寸使用已知记录求解，不保证任意自填颜色都能求解。`);}catch(e){note(e.message,true);}}
  async function turn(group){
    if(!group.length)return;animating=true;update();
    try{if(prefs.animation){const duration=Math.min(650,800/prefs.speed);await new Promise(resolve=>{let begin=null;function frame(now){if(begin===null)begin=now;const t=Math.min(1,(now-begin)/duration);draw(group,.5-.5*Math.cos(Math.PI*t));if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});}model.apply(group);}finally{animating=false;}
  }
  function restore(){if(!start)return;model=HugeCubeModel.restore(start);sampleRevision=-1;cursor=0;playing=false;epoch++;resetPending=false;render();note('已恢复计算前的尺寸、填色、黑格和转动记录。');}
  async function step(direction){if(animating||!plan||direction>0&&cursor>=plan.length||direction<0&&!cursor)return;
    try{await turn(direction>0?plan[cursor]:model.inverse(plan[cursor-1]));cursor+=direction;if(resetPending){restore();return;}render();if(cursor===plan.length)note('还原完成：所有非黑色格子已按记录归位。');}catch(e){playing=false;update();note(e.message,true);}}
  async function run(){
    if(playing){playing=false;epoch++;update();return;}if(animating||!plan||cursor>=plan.length)return;
    playing=true;const current=++epoch;update();let due=performance.now(),lastDraw=0;
    while(playing&&current===epoch&&cursor<plan.length){const now=performance.now(),interval=1000/prefs.speed;if(now<due){await new Promise(resolve=>setTimeout(resolve,Math.min(16,due-now)));continue;}
      if(prefs.animation){await step(1);due=performance.now()+Math.max(0,interval-Math.min(650,800/prefs.speed));}
      else{const batch=Math.min(12,plan.length-cursor,Math.floor((now-due)/interval)+1);for(let i=0;i<batch;i++)model.apply(plan[cursor++]);due+=batch*interval;if(now-lastDraw>120||cursor===plan.length){render();lastDraw=now;}await new Promise(resolve=>setTimeout(resolve,0));}
    }
    if(current===epoch){playing=false;render();if(cursor===plan.length)note('还原完成：所有非黑色格子已按记录归位。');}
  }
  function mount(){
    if(root)return;root=document.createElement('section');root.id='huge-workspace';root.className='huge-workspace';root.hidden=true;
    root.innerHTML=`<div class="panel huge-summary"><div class="panel-heading"><h2>超大尺寸 · 按需计算</h2><button id="huge-shuffle" class="secondary">生成随机魔方</button></div><p id="huge-dimensions"></p><p id="huge-total"></p><p class="hint">完整尺寸和每条转动都精确记录；整体图按格子抽样，局部方格显示精确颜色。无需创建整个魔方。超大尺寸仅支持已知转动记录的还原。</p><p id="huge-record" class="run-help"></p><p id="huge-status" class="status" role="status" aria-live="polite"></p></div>
    <div class="huge-layout"><section class="panel"><h2>局部精确填色</h2><div id="huge-palette" class="palette huge-palette"></div><div class="face-tabs">${faces.map(f=>`<button data-huge-face="${f}">${names[f]} ${f}</button>`).join('')}</div><div class="large-fill-tools"><label>起始行<input id="huge-row" type="number" min="1" step="1" value="1"></label><label>起始列<input id="huge-col" type="number" min="1" step="1" value="1"></label><button id="huge-locate">查看此处</button></div><p id="huge-face-size" class="hint"></p><div id="huge-grid" class="huge-local-grid"></div><div class="run-buttons"><button id="huge-paint" class="secondary">填起始格</button><button id="huge-paint-block" class="secondary">填当前局部区域</button></div><details class="manual-colors"><summary>手动输入局部颜色</summary><p>从起始行、列开始，按当前局部区域的行列输入。支持中文、W/R/G/Y/O/B/K、? 和 W9 等重复写法。</p><textarea id="huge-text" aria-label="局部区域颜色" rows="4"></textarea><button id="huge-apply-text" class="secondary">应用局部颜色</button></details><div class="run-buttons"><button id="huge-clear" class="secondary">清空重填</button><button id="huge-mask-empty" class="secondary">未填格涂黑</button></div></section>
    <section class="panel"><h2>整体抽样预览</h2><canvas id="huge-canvas" class="huge-canvas" aria-label="超大尺寸魔方的抽样三维预览"></canvas><p class="hint">拖动旋转视角。稀疏转动可能未被抽样到，请用层号或局部行列检查；还原判断不依赖抽样图。</p><div class="step-card"><label class="animation-control"><input id="huge-parallel" type="checkbox">并行转动／还原</label><div class="solve-actions"><button id="huge-solve" class="primary">计算还原步骤</button><button id="huge-solve-parallel" class="secondary">计算并行还原</button></div><p id="huge-instruction" class="hint"></p><p id="huge-count"></p><div class="progress"><div id="huge-progress"></div></div><div class="step-buttons"><button id="huge-prev" class="secondary">上一步</button><button id="huge-next" class="primary">下一步</button></div><div class="run-buttons"><button id="huge-run" class="primary">运行</button><button id="huge-reset" class="secondary">重置本次运行</button></div><label class="speed-number-control">运行速度<input id="huge-speed" type="number" min="0.5" max="120" step="0.5" value="4"><span id="huge-speed-unit">步/秒</span></label><label class="animation-control"><input id="huge-animation" type="checkbox" checked>显示转动动画</label></div><details class="manual"><summary>手动转动任意一层</summary><div class="huge-manual"><label>旋转轴<select id="huge-manual-axis"><option>X</option><option>Y</option><option>Z</option></select></label><label>层号<input id="huge-manual-layer" type="number" min="1" step="1" value="1"></label><label>角度<select id="huge-manual-turn"><option value="1">顺时针 90°</option><option value="-1">逆时针 90°</option><option value="2">180°</option></select></label></div><p id="huge-manual-hint" class="hint"></p><button id="huge-manual-apply" class="secondary">执行层转动</button></details></section></div>`;
    normal().after(root);
    $('shuffle').onclick=generate;$('solve').onclick=()=>solve();$('solve-parallel').onclick=()=>solve(true);
    $('next').onclick=()=>{if(!playing)step(1);};$('prev').onclick=()=>{if(!playing)step(-1);};$('run').onclick=run;$('reset').onclick=()=>{playing=false;epoch++;if(animating){resetPending=true;note('当前转动结束后重置。');}else restore();update();};
    $('parallel').onchange=()=>{prefs.parallel=$('parallel').checked;if(plan){const done=schedule(plan.slice(0,cursor).flat()),remaining=schedule(plan.slice(cursor).flat());cursor=done.length;plan=[...done,...remaining];}update();save();};
    $('speed').onchange=()=>{const n=Number($('speed').value);if(!Number.isFinite(n)||n<.5||n>120){$('speed').value=prefs.speed;note('速度需在 0.5–120 之间。',true);return;}prefs.speed=n;save();};$('animation').onchange=()=>{prefs.animation=$('animation').checked;save();};
    $('manual-axis').onchange=manualAxis;$('manual-apply').onclick=async()=>{try{const m=model.normalize({axis:$('manual-axis').value,layer:HugeCube.quantity($('manual-layer').value)-1,turns:Number($('manual-turn').value)});discard();await turn([m]);render();note('该层已转动，记录已保存，可重新计算还原。');}catch(e){note(e.message,true);update();}};
    const locate=()=>{const r=HugeCube.quantity($('row').value)-1,c=HugeCube.quantity($('col').value)-1;model.checkCell(face,r,c);row=r;col=c;};
    $('locate').onclick=()=>{try{locate();localGrid();update();save();}catch(e){note(e.message,true);}};
    $('paint').onclick=()=>{try{locate();model.paint(face,row,col,selected);discard();render();}catch(e){note(e.message,true);}};
    const paintBlock=text=>{locate();const [rows,cols]=model.shapes[face],height=Math.min(12,rows-row),width=Math.min(12,cols-col),entered=text?ColorInput.parseFace($('text').value,height*width):null;for(let r=0;r<height;r++)for(let c=0;c<width;c++){const actual=entered?.[r*width+c];model.paint(face,row+r,col+c,text?(actual===null?'?':actual==='k'?'*':faces[centers.indexOf(actual)]):selected);}discard();render();note(`已应用 ${height*width} 个局部格子。`);};
    $('paint-block').onclick=()=>{try{paintBlock(false);}catch(e){note(e.message,true);}};$('apply-text').onclick=()=>{try{paintBlock(true);}catch(e){note(e.message,true);}};
    $('clear').onclick=()=>{discard();model.reset(true);scrambleCount=null;render();note('已清空。超大尺寸复杂自填状态不保证能求解。');};$('mask-empty').onclick=()=>{model.maskEmpty();discard();render();note('所有未填格已设为黑色忽略。');};
    for(const b of root.querySelectorAll('[data-huge-face]'))b.onclick=()=>{face=b.dataset.hugeFace;row=col=0;localGrid();update();save();};
    let pointer=null;$('canvas').onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY};$('canvas').setPointerCapture(e.pointerId);};$('canvas').onpointermove=e=>{if(pointer){view.y+=(e.clientX-pointer.x)*.5;view.x-=(e.clientY-pointer.y)*.5;pointer={x:e.clientX,y:e.clientY};if(!animating)draw();}};$('canvas').onpointerup=$('canvas').onpointercancel=()=>pointer=null;
    window.addEventListener('resize',()=>{if(model&&!root.hidden&&!animating)draw();});
    for(const id of ['demo','random-black','all-black'])document.getElementById(id).addEventListener('click',e=>{if(!model)return;e.stopImmediatePropagation();e.preventDefault();if(!animating&&!playing)({'demo':generate,'random-black':randomBlack,'all-black':allBlack}[id])();},true);
  }
  function open(dims,options={}){
    dimensions(dims);if(animating||playing)return;mount();discard();model=options.state?HugeCubeModel.restore(options.state):new HugeCubeModel(dims);centers=options.centers||centers;
    prefs={...prefs,...options.prefs};scrambleCount=options.scrambleCount??null;face=faces.includes(options.face)?options.face:'F';row=options.row||0;col=options.col||0;sampleRevision=-1;
    normal().hidden=true;normal().style.display='none';root.hidden=false;root.style.display='block';dims.forEach((n,i)=>document.getElementById('size-'+axes[i].toLowerCase()).value=n);
    document.querySelector('.size-panel').classList.add('huge-active');document.getElementById('size-tag').textContent='超大尺寸';document.getElementById('solver-scope').textContent='超大尺寸自动按需计算，不分配全部格子。支持随机生成、精确行列填色、手动转动及已知记录还原。';
    document.getElementById('scramble-info').textContent='超大尺寸随机长度随阶数增长，最多随机取 5000–10000 步，避免生成无法完成的天文数量步骤。';
    $('dimensions').textContent=dims.map(fmt).join(' × ');$('total').textContent=`表面共 ${fmt(count(dims))} 个格子（精确计数）。`;
    $('parallel').checked=prefs.parallel;$('animation').checked=prefs.animation;$('speed').value=prefs.speed;manualAxis();render();note('超大尺寸已应用。可直接生成随机魔方；也可按行列定位任意一个格子。');
  }
  function close(){if(!model)return;playing=false;epoch++;model=null;root.hidden=true;root.style.display='none';normal().hidden=false;normal().style.display='';document.querySelector('.size-panel').classList.remove('huge-active');try{localStorage.removeItem('cube-huge-active');}catch{}}
  function restoreSaved(){try{if(localStorage.getItem('cube-huge-active')!=='1')return;const data=JSON.parse(localStorage.getItem('cube-huge-v1'));if(data?.state)open(data.state.dimensions,data);}catch{try{localStorage.removeItem('cube-huge-active');}catch{}}}
  window.HugeCubeApp={open,close,restoreSaved,showError:text=>note(text,true),requires:dims=>dimensions(dims).some(n=>n>200),get active(){return !!model;}};
})();
