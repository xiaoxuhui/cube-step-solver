(function(root){
  class LargeCubeView {
    constructor(){this.face='F';this.zoom=1;this.scroll={left:0,top:0};}
    renderNet({net,model,stickers,colors,disabled,onPaint}){
      const old=net.querySelector('.large-fill-scroll');if(old)this.scroll={left:old.scrollLeft,top:old.scrollTop};
      net.replaceChildren();net.className='net large-net';net.style.cssText='display:block;min-width:0;max-width:none';
      const tabs=document.createElement('div');tabs.className='face-tabs';
      const names={U:'上',R:'右',F:'前',D:'下',L:'左',B:'后'};
      for(const face of ['U','R','F','D','L','B']){
        const b=document.createElement('button');b.textContent=names[face]+' '+face;b.setAttribute('aria-pressed',String(this.face===face));b.disabled=disabled;
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
    renderScene({scene,cube,model,stickers,colors,view}){
      cube.hidden=true;let canvas=scene.querySelector('#large-preview');if(!canvas){canvas=document.createElement('canvas');canvas.id='large-preview';canvas.setAttribute('aria-label','大尺寸魔方抽样三维预览');scene.append(canvas);}
      const width=scene.clientWidth||400,height=scene.clientHeight||335;canvas.width=width;canvas.height=height;canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      const ctx=canvas.getContext('2d'),scale=180/Math.max(...model.dims)*view.scale;
      const angles=[view.x,view.y,view.z].map(x=>x*Math.PI/180);
      function transform(v){let [x,y,z]=v;let a=angles[2];[x,y]=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];a=angles[1];[x,z]=[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];a=angles[0];[y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];return [x,y,z];}
      const basis={F:[[1,0,0],[0,-1,0]],B:[[-1,0,0],[0,-1,0]],R:[[0,0,-1],[0,-1,0]],L:[[0,0,1],[0,-1,0]],U:[[1,0,0],[0,0,1]],D:[[1,0,0],[0,0,-1]]},polygons=[];
      for(const face of ['U','R','F','D','L','B']){
        const [rows,cols]=model.shapes[face],normal=model.cells[model.offsets[face]].n;if(transform([normal[0],-normal[1],normal[2]])[2]<=0)continue;
        const rs=Math.ceil(rows/24),cs=Math.ceil(cols/24),[u,v]=basis[face];
        for(let r=0;r<rows;r+=rs)for(let c=0;c<cols;c+=cs){
          const re=Math.min(rows,r+rs),ce=Math.min(cols,c+cs),first=model.cells[model.offsets[face]+r*cols+c],last=model.cells[model.offsets[face]+(re-1)*cols+ce-1];
          const center=first.p.map((p,i)=>(p+last.p[i])/2+normal[i]),points=[];
          for(const [a,b]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=center.map((x,i)=>(x+a*u[i]*(ce-c)*.97+b*v[i]*(re-r)*.97)*scale/2);p[1]*=-1;points.push(transform(p));}
          const index=model.offsets[face]+Math.floor((r+re-1)/2)*cols+Math.floor((c+ce-1)/2);polygons.push({points,color:colors[stickers[index]]?.hex||'#323d50',depth:points.reduce((s,p)=>s+p[2],0)/4});
        }
      }
      polygons.sort((a,b)=>a.depth-b.depth);ctx.lineWidth=.7;ctx.strokeStyle='#11151d';
      for(const poly of polygons){ctx.beginPath();poly.points.forEach((p,i)=>{const f=900/(900-p[2]),x=width/2+p[0]*f,y=height*.48+p[1]*f;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fillStyle=poly.color;ctx.fill();ctx.stroke();}
    }
  }
  root.LargeCubeView=LargeCubeView;
})(typeof self!=='undefined'?self:globalThis);
