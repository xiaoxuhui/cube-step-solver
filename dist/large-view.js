(function(root){
  const basis={F:[[1,0,0],[0,-1,0]],B:[[-1,0,0],[0,-1,0]],R:[[0,0,-1],[0,-1,0]],L:[[0,0,1],[0,-1,0]],U:[[1,0,0],[0,0,1]],D:[[1,0,0],[0,0,-1]]};
  function rotate(v,axis,angle){
    const [x,y,z]=v,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    return axis==='X'?[x,y*c-z*s,y*s+z*c]:axis==='Y'?[x*c+z*s,y,-x*s+z*c]:[x*c-y*s,x*s+y*c,z];
  }
  function intervals(length,step,start,delta,rotation){
    const cuts=new Set([0,length]);for(let i=step;i<length;i+=step)cuts.add(i);
    if(rotation&&delta){const i=(rotation.coordinate-start)/delta;if(Number.isInteger(i)&&i>=0&&i<length){cuts.add(i);cuts.add(i+1);}}
    const points=[...cuts].sort((a,b)=>a-b);return points.slice(0,-1).map((n,i)=>[n,points[i+1]]);
  }
  function buildPatches(model,rotation=null,maxSegments=24,gap=.97){
    const patches=[],ai=rotation?model.axisIndex(rotation.axis):-1;
    for(const face of ['U','R','F','D','L','B']){
      const [rows,cols]=model.shapes[face],firstCell=model.cells[model.offsets[face]],normal=firstCell.n,[u,v]=basis[face];
      const rowRanges=intervals(rows,Math.ceil(rows/maxSegments),firstCell.p[ai],2*v[ai],rotation),colRanges=intervals(cols,Math.ceil(cols/maxSegments),firstCell.p[ai],2*u[ai],rotation);
      for(const [r,re]of rowRanges)for(const [c,ce]of colRanges){
        const first=model.cells[model.offsets[face]+r*cols+c],last=model.cells[model.offsets[face]+(re-1)*cols+ce-1],position=first.p.map((p,i)=>(p+last.p[i])/2);
        const center=position.map((p,i)=>p+normal[i]),points=[];
        for(const [a,b]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=center.map((x,i)=>x+a*u[i]*(ce-c)*gap+b*v[i]*(re-r)*gap);p[1]*=-1;points.push(p);}
        const moving=!!rotation&&position[ai]===rotation.coordinate;
        const inLayer=(row,col)=>row>=0&&row<rows&&col>=0&&col<cols&&model.cells[model.offsets[face]+row*cols+col].p[ai]===rotation?.coordinate;
        patches.push({points,face,range:{row:r,col:c,rows:re-r,cols:ce-c},normal:[normal[0],-normal[1],normal[2]],moving,edges:moving?[!inLayer(r-1,c),!inLayer(r,ce),!inLayer(re,c),!inLayer(r,c-1)]:[],index:model.offsets[face]+Math.floor((r+re-1)/2)*cols+Math.floor((c+ce-1)/2)});
      }
    }
    return patches;
  }
  function triangleTransform(source,target){
    const [a,b,c]=source,[p,q,r]=target,du=b[0]-a[0],dv=b[1]-a[1],eu=c[0]-a[0],ev=c[1]-a[1],det=du*ev-eu*dv;
    if(Math.abs(det)<1e-10)return null;
    const m00=((q[0]-p[0])*ev-(r[0]-p[0])*dv)/det,m01=(du*(r[0]-p[0])-eu*(q[0]-p[0]))/det;
    const m10=((q[1]-p[1])*ev-(r[1]-p[1])*dv)/det,m11=(du*(r[1]-p[1])-eu*(q[1]-p[1]))/det;
    return [m00,m10,m01,m11,p[0]-m00*a[0]-m01*a[1],p[1]-m10*a[0]-m11*a[1]];
  }
  function drawTriangle(ctx,texture,source,target){
    const matrix=triangleTransform(source,target);if(!matrix)return;
    const cx=target.reduce((s,p)=>s+p[0],0)/3,cy=target.reduce((s,p)=>s+p[1],0)/3;
    // Slightly overlap mesh triangles so antialiased clips cannot leave seams.
    const clip=target.map(p=>{const dx=p[0]-cx,dy=p[1]-cy,length=Math.hypot(dx,dy)||1;return [p[0]+dx/length*.45,p[1]+dy/length*.45];});
    ctx.save();ctx.beginPath();clip.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();ctx.transform(...matrix);ctx.drawImage(texture,0,0);ctx.restore();
  }
  class LargeCubeView {
    constructor(){this.face='F';this.zoom=1;this.scroll={left:0,top:0};}
    renderNet({net,model,stickers,colors,disabled,onPaint}){
      const old=net.querySelector('.large-fill-scroll');if(old)this.scroll={left:old.scrollLeft,top:old.scrollTop};
      net.replaceChildren();net.className='net large-net';net.style.cssText='display:block;min-width:0;max-width:none';
      const tabs=document.createElement('div');tabs.className='face-tabs';
      const names={U:'上',R:'右',F:'前',D:'下',L:'左',B:'后'};
      for(const face of ['U','R','F','D','L','B']){
        const b=document.createElement('button');b.textContent=names[face]+' '+face;b.dataset.face=face;b.setAttribute('aria-pressed',String(this.face===face));b.disabled=disabled;
        b.onclick=()=>{this.face=face;this.scroll={left:0,top:0};net.querySelector('.large-fill-scroll')?.remove();this.renderNet({net,model,stickers,colors,disabled,onPaint});};tabs.append(b);
      }
      const [rows,cols]=model.shapes[this.face],tools=document.createElement('div');tools.className='large-fill-tools';
      const row=document.createElement('input'),col=document.createElement('input'),paint=document.createElement('button');
      for(const [el,max,label]of [[row,rows,'行'],[col,cols,'列']]){el.type='number';el.min=1;el.max=max;el.value=1;el.disabled=disabled;el.setAttribute('aria-label','大尺寸填色'+label);const l=document.createElement('label');l.textContent=label;l.append(el);tools.append(l);}
      paint.textContent='填入当前颜色';paint.disabled=disabled;paint.onclick=()=>{const r=Number(row.value),c=Number(col.value);if(Number.isInteger(r)&&Number.isInteger(c)&&r>=1&&r<=rows&&c>=1&&c<=cols)onPaint(model.offsets[this.face]+(r-1)*cols+c-1);};tools.append(paint);
      const zoomLabel=document.createElement('label');zoomLabel.className='fill-zoom';zoomLabel.textContent='填色放大';const zoom=document.createElement('input');zoom.type='range';zoom.min='.5';zoom.max='2';zoom.step='.25';zoom.value=this.zoom;zoom.setAttribute('aria-label','填色放大倍数');zoomLabel.append(zoom);
      const viewport=document.createElement('div');viewport.className='large-fill-scroll';const canvas=document.createElement('canvas');canvas.id='large-face-canvas';canvas.setAttribute('aria-label',`${names[this.face]}面 ${rows} 行 ${cols} 列填色画布，可用行列输入精确填色`);
      const unit=12;canvas.width=cols*unit;canvas.height=rows*unit;const styleSize=()=>{canvas.style.width=cols*16*this.zoom+'px';canvas.style.height=rows*16*this.zoom+'px';};styleSize();
      const ctx=canvas.getContext('2d');ctx.fillStyle='#090c12';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){ctx.fillStyle=colors[stickers[model.offsets[this.face]+r*cols+c]]?.hex||'#323d50';ctx.fillRect(c*unit+1,r*unit+1,unit-1,unit-1);}
      canvas.onclick=e=>{if(disabled)return;const rect=canvas.getBoundingClientRect(),r=Math.floor((e.clientY-rect.top)/rect.height*rows),c=Math.floor((e.clientX-rect.left)/rect.width*cols);if(r>=0&&r<rows&&c>=0&&c<cols)onPaint(model.offsets[this.face]+r*cols+c);};
      zoom.oninput=()=>{this.zoom=Number(zoom.value);styleSize();};viewport.append(canvas);net.append(tabs,tools,zoomLabel,viewport);viewport.scrollLeft=this.scroll.left;viewport.scrollTop=this.scroll.top;
    }
    renderScene({scene,cube,model,stickers,colors,view,rotation=null}){
      cube.hidden=true;let canvas=scene.querySelector('#large-preview');if(!canvas){canvas=document.createElement('canvas');canvas.id='large-preview';canvas.setAttribute('aria-label','大尺寸魔方三维预览，按真实颜色网格绘制');scene.append(canvas);}
      const width=scene.clientWidth||400,height=scene.clientHeight||335,dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      const ctx=canvas.getContext('2d'),scale=90/Math.max(...model.dims)*view.scale;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      const [ax,ay,az]=[view.x,view.y,view.z].map(x=>x*Math.PI/180),cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay),cz=Math.cos(az),sz=Math.sin(az);
      function transform(v){let [x,y,z]=v;[x,y]=[x*cz-y*sz,x*sz+y*cz];[x,z]=[x*cy+z*sy,-x*sy+z*cy];return [x,y*cx-z*sx,y*sx+z*cx];}
      const patchKey=rotation?rotation.axis+':'+rotation.coordinate:'idle';
      if(this.patchModel!==model||this.patchKey!==patchKey){this.patchModel=model;this.patchKey=patchKey;this.patches=buildPatches(model,rotation,12,1);}
      const detailUnit=Math.min(8,2**Math.floor(Math.log2(Math.max(1,400*dpr*view.scale/Math.max(...model.dims)))));
      const gridOpacity=Math.round(Math.max(0,Math.min(1,(180*view.scale*dpr/Math.max(...model.dims)-2)/3))*100)/100;
      if(this.textureModel!==model||this.textureStickers!==stickers||this.textureColors!==colors||this.textureDetail!==detailUnit||this.textureGrid!==gridOpacity){this.textureModel=model;this.textureStickers=stickers;this.textureColors=colors;this.textureDetail=detailUnit;this.textureGrid=gridOpacity;this.textures=new Map();}
      const textureFor=face=>{
        if(this.textures.has(face))return this.textures.get(face);
        const [rows,cols]=model.shapes[face],unit=8,image=document.createElement('canvas');image.width=cols*unit;image.height=rows*unit;
        const paint=image.getContext('2d'),borders={};
        for(const [name,color]of Object.entries(colors)){const rgb=[1,3,5].map(i=>parseInt(color.hex.slice(i,i+2),16)),dark=[16,20,29];borders[name]='rgb('+rgb.map((v,i)=>Math.round(v*(1-gridOpacity)+dark[i]*gridOpacity)).join(',')+')';}
        for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
          const name=stickers[model.offsets[face]+r*cols+c],color=colors[name]?.hex||'#323d50';
          paint.fillStyle=gridOpacity?(borders[name]||'#10141d'):color;paint.fillRect(c*unit,r*unit,unit,unit);
          if(gridOpacity){paint.fillStyle=color;paint.fillRect(c*unit+.25,r*unit+.25,unit-.5,unit-.5);}
        }
        let filtered=image;if(detailUnit<unit){filtered=document.createElement('canvas');filtered.width=cols*detailUnit;filtered.height=rows*detailUnit;const filter=filtered.getContext('2d');filter.imageSmoothingEnabled=true;filter.imageSmoothingQuality='high';filter.drawImage(image,0,0,filtered.width,filtered.height);}
        const result={image:filtered,unit:detailUnit};this.textures.set(face,result);return result;
      };
      const polygons=[];
      for(const patch of this.patches){
        const normal=rotation&&patch.moving?rotate(patch.normal,rotation.axis,rotation.angle):patch.normal;
        if(transform(normal)[2]<=1e-7)continue;
        const points=patch.points.map(p=>transform((rotation&&patch.moving?rotate(p,rotation.axis,rotation.angle):p).map(x=>x*scale)));
        polygons.push({points,patch,depth:points.reduce((s,p)=>s+p[2],0)/4});
      }
      polygons.sort((a,b)=>a.depth-b.depth);
      for(const poly of polygons){
        const {patch}=poly,{image,unit}=textureFor(patch.face),r=patch.range,uv=[[r.col*unit,r.row*unit],[(r.col+r.cols)*unit,r.row*unit],[(r.col+r.cols)*unit,(r.row+r.rows)*unit],[r.col*unit,(r.row+r.rows)*unit]];
        const screen=poly.points.map(p=>{const f=900/(900-p[2]);return [width/2+p[0]*f,height*.48+p[1]*f];});
        for(const indices of [[0,1,2],[0,2,3]])drawTriangle(ctx,image,indices.map(i=>uv[i]),indices.map(i=>screen[i]));
        if(patch.moving){ctx.beginPath();for(let i=0;i<4;i++)if(patch.edges[i]){ctx.moveTo(...screen[i]);ctx.lineTo(...screen[(i+1)%4]);}ctx.strokeStyle='#b4a0ff';ctx.lineWidth=.9;ctx.stroke();}
      }
    }
  }
  LargeCubeView.buildPatches=buildPatches;LargeCubeView.rotate=rotate;LargeCubeView.triangleTransform=triangleTransform;
  root.LargeCubeView=LargeCubeView;
  if(typeof module!=='undefined')module.exports={LargeCubeView};
})(typeof self!=='undefined'?self:globalThis);
