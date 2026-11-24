(function(root){
  // Coordinates use 2 * index - dimension + 1. Keep every intermediate integer exact.
  const MAX_DIMENSION=Math.floor(Number.MAX_SAFE_INTEGER/2),MAX_HISTORY=20000;
  const faces=['U','R','F','D','L','B'],axes=['X','Y','Z'];
  function dimensions(value){
    if(!Array.isArray(value)||value.length!==3||value.some(n=>!Number.isSafeInteger(n)||n<1||n>MAX_DIMENSION))throw Error(`X、Y、Z 必须是 1 到 ${MAX_DIMENSION} 的整数。`);
    return [...value];
  }
  function count(dims){const [x,y,z]=dimensions(dims).map(BigInt);return 2n*(x*y+x*z+y*z);}
  function quantity(value){
    // Parse before converting to Number: a decimal near the maximum can otherwise round to an integer.
    const text=String(value).trim(),m=/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
    if(!m||text.length>100)throw Error(`数量必须是 1 到 ${MAX_DIMENSION} 的整数。`);
    const exponent=Number(m[3]||0),fraction=m[2]||'';if(!Number.isInteger(exponent)||Math.abs(exponent)>100)throw Error('数量超出可精确处理的范围。');
    let n=BigInt(m[1]+fraction);const shift=exponent-fraction.length;
    if(shift>=0)n*=10n**BigInt(shift);else{const divisor=10n**BigInt(-shift);if(n%divisor)throw Error('数量必须是整数，不能含有小数。');n/=divisor;}
    if(n<1n||n>BigInt(MAX_DIMENSION))throw Error(`数量必须是 1 到 ${MAX_DIMENSION} 的整数。`);return Number(n);
  }
  function hash(face,row,col,seed){
    let h=seed>>>0;for(const n of [faces.indexOf(face)+1,row>>>0,Math.floor(row/4294967296),col>>>0,Math.floor(col/4294967296)]){h=Math.imul(h^n,0x45d9f3b);h^=h>>>16;}return h>>>0;
  }
  class HugeCubeModel{
    constructor(dims){
      this.dims=dimensions(dims);const [X,Y,Z]=this.dims;
      this.shapes={U:[Z,X],R:[Y,Z],F:[Y,X],D:[Z,X],L:[Y,Z],B:[Y,X]};
      this.turns=[];this.edits=new Map();this.masks=[];this.baseFaces=[...faces];this.compiled=null;this.revision=0;
    }
    square(axis){const a=axes.indexOf(axis);return a>=0&&this.dims[(a+1)%3]===this.dims[(a+2)%3];}
    normalize(move){
      const a=axes.indexOf(move?.axis);if(a<0||!Number.isSafeInteger(move.layer)||move.layer<0||move.layer>=this.dims[a]||![-2,-1,1,2].includes(move.turns))throw Error('转动轴、层号或角度无效。');
      if(Math.abs(move.turns)!==2&&!this.square(move.axis))throw Error('这个轴的截面不是正方形，只能转动 180°。');
      return {axis:move.axis,layer:move.layer,turns:Math.abs(move.turns)===2?2:move.turns};
    }
    group(list){
      const moves=(Array.isArray(list)?list:[list]).map(m=>this.normalize(m));if(!moves.length)return [];
      if(moves.some(m=>m.axis!==moves[0].axis))throw Error('并行组只能包含同一个轴。');
      const sums=new Map();for(const m of moves)sums.set(m.layer,((sums.get(m.layer)||0)+m.turns+4)%4);
      return [...sums].sort((a,b)=>a[0]-b[0]).filter(([,q])=>q).map(([layer,q])=>({axis:moves[0].axis,layer,turns:q===3?-1:q}));
    }
    groups(list){
      const out=[];for(const m of list){const move=this.normalize(m),last=out[out.length-1];if(last&&last[0].axis===move.axis){out.pop();const combined=this.group([...last,move]);if(combined.length)out.push(combined);}else out.push([move]);}return out;
    }
    inverse(list){return this.group(list).map(m=>({...m,turns:m.turns===2?2:-m.turns}));}
    apply(list){
      const incoming=this.group(list);if(!incoming.length)return;
      // Only reorder the tail on the same axis. It also makes exact undo remove its record.
      let start=this.turns.length;while(start&&this.turns[start-1].axis===incoming[0].axis)start--;
      const tail=this.group([...this.turns.slice(start),...incoming]);
      if(start+tail.length>MAX_HISTORY)throw Error(`转动记录已达到 ${MAX_HISTORY} 条，请先还原或重新生成。`);
      this.turns.splice(start,this.turns.length-start,...tail);this.compiled=null;this.revision++;
    }
    checkCell(face,row,col){const shape=this.shapes[face];if(!shape||!Number.isSafeInteger(row)||!Number.isSafeInteger(col)||row<0||col<0||row>=shape[0]||col>=shape[1])throw Error('行列超出这个面的范围。');}
    geometry(face,row,col){
      const [X,Y,Z]=this.dims,x=2*col-X+1,y=Y-1-2*row,z=2*col-Z+1;
      switch(face){case 'F':return {p:[x,y,Z-1],n:[0,0,1]};case 'B':return {p:[-x,y,1-Z],n:[0,0,-1]};case 'R':return {p:[X-1,y,-z],n:[1,0,0]};case 'L':return {p:[1-X,y,z],n:[-1,0,0]};case 'U':return {p:[x,Y-1,2*row-Z+1],n:[0,1,0]};case 'D':return {p:[x,1-Y,Z-1-2*row],n:[0,-1,0]};default:throw Error('面无效。');}
    }
    cell(p,n){
      const [X,Y,Z]=this.dims,[x,y,z]=p;
      if(n[2]===1)return {face:'F',row:(Y-1-y)/2,col:(x+X-1)/2};
      if(n[2]===-1)return {face:'B',row:(Y-1-y)/2,col:(X-1-x)/2};
      if(n[0]===1)return {face:'R',row:(Y-1-y)/2,col:(Z-1-z)/2};
      if(n[0]===-1)return {face:'L',row:(Y-1-y)/2,col:(z+Z-1)/2};
      if(n[1]===1)return {face:'U',row:(z+Z-1)/2,col:(x+X-1)/2};
      return {face:'D',row:(Z-1-z)/2,col:(x+X-1)/2};
    }
    origin(face,row,col){
      this.checkCell(face,row,col);const {p,n}=this.geometry(face,row,col);
      if(!this.compiled)this.compiled=this.turns.map(m=>{const a=axes.indexOf(m.axis);return [a,2*m.layer-this.dims[a]+1,(4-m.turns)%4];});
      for(let i=this.compiled.length-1;i>=0;i--){const [a,coordinate,q]=this.compiled[i];if(p[a]!==coordinate)continue;
        for(let j=0;j<q;j++){
          if(a===0){[p[1],p[2]]=[p[2],-p[1]];[n[1],n[2]]=[n[2],-n[1]];}
          else if(a===1){[p[0],p[2]]=[-p[2],p[0]];[n[0],n[2]]=[-n[2],n[0]];}
          else{[p[0],p[1]]=[p[1],-p[0]];[n[0],n[1]]=[n[1],-n[0]];}
        }
      }
      return this.cell(p,n);
    }
    baseColor(face,row,col){
      const edit=this.edits.get(`${face}:${row}:${col}`),color=edit?.color||this.baseFaces[faces.indexOf(face)];
      if(color==='?'||color==='*')return color;
      for(let i=edit?.maskCount||0;i<this.masks.length;i++){const m=this.masks[i];if(hash(face,row,col,m.seed)/4294967296<m.percent/100)return '*';}
      return color;
    }
    colorAt(face,row,col){const cell=this.origin(face,row,col);return this.baseColor(cell.face,cell.row,cell.col);}
    paint(face,row,col,color){
      if(![...faces,'*','?'].includes(color))throw Error('颜色无效。');
      const origin=this.origin(face,row,col),key=`${origin.face}:${origin.row}:${origin.col}`;
      if(!this.edits.has(key)&&this.edits.size>=100000)throw Error('已保存 100000 个单独填色格子，请先重置填色。');
      this.edits.set(key,{...origin,color,maskCount:this.masks.length});this.revision++;
    }
    black(percent,seed=Math.floor(Math.random()*4294967296)){
      if(!Number.isInteger(percent)||percent<0||percent>100)throw Error('涂黑比例必须是 0–100 的整数。');
      if(this.masks.length>=100)throw Error('随机涂黑已达到 100 次，请重新生成后再试。');
      if(percent)this.masks.push({percent,seed:seed>>>0});this.revision++;
    }
    maskEmpty(){this.baseFaces=this.baseFaces.map(c=>c==='?'?'*':c);for(const edit of this.edits.values())if(edit.color==='?')edit.color='*';this.revision++;}
    fillBlack(){this.baseFaces=faces.map(()=>'*');this.edits.clear();this.masks=[];this.revision++;}
    reset(clear=false){this.turns=[];this.edits.clear();this.masks=[];this.baseFaces=faces.map(f=>clear?'?':f);this.compiled=null;this.revision++;}
    randomLength(random=Math.random){const n=Math.max(...this.dims),lo=Math.min(5000,Math.max(12,n*6)),hi=Math.min(10000,Math.max(24,n*12));return lo+Math.floor(random()*(hi-lo+1));}
    scramble(length=this.randomLength(),random=Math.random){
      if(!Number.isInteger(length)||length<0||length>10000)throw Error('打乱记录需为 0–10000 步。');
      this.reset();let last=null;
      for(let i=0;i<length;i++){let axis=axes[Math.floor(random()*3)],a=axes.indexOf(axis),layer=Math.floor(random()*this.dims[a]);if(last&&axis===last.axis&&layer===last.layer){a=(a+1)%3;axis=axes[a];layer=Math.floor(random()*this.dims[a]);}const move={axis,layer,turns:this.square(axis)?[1,-1,2][Math.floor(random()*3)]:2};this.turns.push(move);last=move;}
      this.compiled=null;this.revision++;return length;
    }
    baselineSolved(){
      for(const f of faces){if(this.baseFaces[faces.indexOf(f)]!==f&&this.baseFaces[faces.indexOf(f)]!=='*')return false;}
      for(const edit of this.edits.values()){const color=this.baseColor(edit.face,edit.row,edit.col);if(color!=='*'&&color!==edit.face)return false;}return true;
    }
    solution(){
      if(this.baseFaces.every(c=>c==='*')&&!this.edits.size)return [];
      if(!this.baselineSolved())throw Error('这些手动颜色不能通过已知记录验证还原。超大尺寸支持还原本工具随机生成或手动转动的状态；涂黑忽略和与原目标一致的填色也支持。');
      const inverse=[...this.turns].reverse().map(m=>({...m,turns:Math.abs(m.turns)===2?2:-m.turns}));
      // Algebraic verification: composing the exact inverse must cancel every axis block.
      if(this.groups([...this.turns,...inverse]).length)throw Error('还原记录验证失败。');
      return inverse;
    }
    snapshot(){return {dimensions:[...this.dims],turns:this.turns.map(m=>({...m})),edits:[...this.edits.values()].map(e=>({...e})),masks:this.masks.map(m=>({...m})),baseFaces:[...this.baseFaces]};}
    static restore(data){
      const model=new HugeCubeModel(data.dimensions);
      if(!Array.isArray(data.turns)||data.turns.length>MAX_HISTORY||!Array.isArray(data.edits)||data.edits.length>100000||!Array.isArray(data.masks)||data.masks.length>100||!Array.isArray(data.baseFaces)||data.baseFaces.length!==6||data.baseFaces.some(c=>![...faces,'*','?'].includes(c)))throw Error('超大魔方保存记录无效。');
      model.turns=data.turns.map(m=>model.normalize(m));model.baseFaces=[...data.baseFaces];
      for(const mask of data.masks){if(!Number.isInteger(mask.percent)||mask.percent<0||mask.percent>100||!Number.isInteger(mask.seed))throw Error('涂黑记录无效。');model.masks.push({percent:mask.percent,seed:mask.seed>>>0});}
      for(const edit of data.edits){model.checkCell(edit.face,edit.row,edit.col);if(![...faces,'*','?'].includes(edit.color)||!Number.isInteger(edit.maskCount)||edit.maskCount<0||edit.maskCount>model.masks.length)throw Error('填色记录无效。');model.edits.set(`${edit.face}:${edit.row}:${edit.col}`,{...edit});}return model;
    }
  }
  const api={HugeCubeModel,MAX_DIMENSION,MAX_HISTORY,dimensions,quantity,count,faces,axes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HugeCube=api;
})(typeof globalThis!=='undefined'?globalThis:this);
