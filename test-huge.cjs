const assert=require('node:assert/strict');
const {CuboidModel}=require('./dist/cuboid');
const {HugeCubeModel,MAX_DIMENSION,dimensions,quantity,count,faces}=require('./dist/huge-model');
let seed=11927;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const dims of [[1,1,1],[2,2,2],[3,3,3],[7,7,7],[2,3,4],[1,8,2]]){
  const exact=new CuboidModel(dims),lazy=new HugeCubeModel(dims);let state=exact.solved;
  const same=()=>{for(let i=0;i<exact.cells.length;i++){const cell=exact.cells[i];assert.equal(lazy.colorAt(cell.face,cell.row,cell.col),state[i],`${dims} ${cell.face} ${cell.row},${cell.col}`);}};
  const legal=exact.legalMoves();same();
  for(let i=0;i<70;i++){const move=legal[Math.floor(random()*legal.length)];state=exact.apply(state,move);lazy.apply([move]);if(i%10===0)same();}same();
  for(let i=0;i<10;i++){const index=Math.floor(random()*state.length),cell=exact.cells[index];lazy.paint(cell.face,cell.row,cell.col,'*');state=state.slice(0,index)+'*'+state.slice(index+1);}same();
  const saved=lazy.snapshot();const reload=HugeCubeModel.restore(JSON.parse(JSON.stringify(saved)));for(const c of exact.cells)assert.equal(reload.colorAt(c.face,c.row,c.col),lazy.colorAt(c.face,c.row,c.col));
  const answer=lazy.solution();for(const move of answer){state=exact.apply(state,move);lazy.apply([move]);}same();assert(exact.isSolved(state));assert.equal(lazy.turns.length,0);
  lazy.scramble(80,random);state=exact.solved;for(const move of lazy.turns)state=exact.apply(state,move);same();
  const before=lazy.snapshot(),groups=lazy.groups(lazy.solution());for(const group of groups){for(const move of group)state=exact.apply(state,move);lazy.apply(group);}same();assert(exact.isSolved(state));
  for(const group of [...groups].reverse())lazy.apply(lazy.inverse(group));for(const cell of exact.cells)assert.equal(lazy.colorAt(cell.face,cell.row,cell.col),HugeCubeModel.restore(before).colorAt(cell.face,cell.row,cell.col));
}
for(const dims of [[MAX_DIMENSION,MAX_DIMENSION,MAX_DIMENSION],[MAX_DIMENSION,1,1],[1,MAX_DIMENSION,17],[2,3,MAX_DIMENSION]]){
  const model=new HugeCubeModel(dims);assert.equal(model.turns.length,0);assert.equal(model.edits.size,0);assert.equal(typeof count(dims),'bigint');
  for(const f of faces){const [rows,cols]=model.shapes[f];for(const r of [0,Math.floor(rows/2),rows-1])for(const c of [0,Math.floor(cols/2),cols-1]){const g=model.geometry(f,r,c),cell=model.cell(g.p,g.n);assert.deepEqual(cell,{face:f,row:r,col:c});assert.equal(model.colorAt(f,r,c),f);}}
  model.scramble(200,random);for(const f of faces){const [rows,cols]=model.shapes[f];for(const [r,c]of [[0,0],[rows-1,cols-1],[Math.floor(rows/2),Math.floor(cols/2)]]){const origin=model.origin(f,r,c);model.checkCell(origin.face,origin.row,origin.col);assert(faces.includes(model.colorAt(f,r,c)));}}
  const plan=model.groups(model.solution());for(const group of plan)model.apply(group);assert.equal(model.turns.length,0);
}
const max=new HugeCubeModel([MAX_DIMENSION,MAX_DIMENSION,MAX_DIMENSION]);assert.equal(count(max.dims),6n*BigInt(MAX_DIMENSION)**2n);assert.equal(max.randomLength(()=>0),5000);assert.equal(max.randomLength(()=>1-Number.EPSILON),10000);
// Embed a three-layer coordinate lattice at the actual integer boundary. Every
// sampled color must agree after quarter/half turns, including outermost rows.
for(const smallDims of [[3,3,3],[3,1,3]]){
  const hugeDims=smallDims.map(n=>n===1?1:MAX_DIMENSION),huge=new HugeCubeModel(hugeDims),small=new CuboidModel(smallDims),legal=small.legalMoves();let text=small.solved;
  for(let i=0;i<60;i++){const m=legal[Math.floor(random()*legal.length)],a=['X','Y','Z'].indexOf(m.axis),layer=smallDims[a]===1?0:m.layer===0?0:m.layer===2?MAX_DIMENSION-1:(MAX_DIMENSION-1)/2;huge.apply([{...m,layer}]);text=small.apply(text,m);
    for(const cell of small.cells){const [rows,cols]=small.shapes[cell.face],[hr,hc]=huge.shapes[cell.face];assert.equal(huge.colorAt(cell.face,rows===1?0:cell.row*(hr-1)/(rows-1),cols===1?0:cell.col*(hc-1)/(cols-1)),text[small.offsets[cell.face]+cell.index]);}
  }
}
max.apply([{axis:'X',layer:MAX_DIMENSION-1,turns:1},{axis:'X',layer:MAX_DIMENSION-2,turns:-1}]);max.apply(max.inverse(max.turns));assert.equal(max.turns.length,0);
max.paint('F',MAX_DIMENSION-1,MAX_DIMENSION-1,'R');assert.throws(()=>max.solution(),/手动颜色/);max.black(100,12);assert.equal(max.colorAt('F',MAX_DIMENSION-1,MAX_DIMENSION-1),'*');assert(max.solution());max.paint('F',MAX_DIMENSION-1,MAX_DIMENSION-1,'F');assert.equal(max.colorAt('F',MAX_DIMENSION-1,MAX_DIMENSION-1),'F');
for(const value of [0,-1,.5,NaN,Infinity,MAX_DIMENSION+1,Number.MAX_SAFE_INTEGER])assert.throws(()=>dimensions([value,3,3]),/整数/);
assert.equal(quantity('1e6'),1000000);assert.equal(quantity('1000.00'),1000);assert.equal(quantity(String(MAX_DIMENSION)),MAX_DIMENSION);assert.throws(()=>quantity(`${MAX_DIMENSION}.1`),/整数/);assert.throws(()=>quantity('1.5'),/整数/);assert.throws(()=>quantity(''),/整数/);assert.throws(()=>quantity('1e100000'),/范围/);
assert.throws(()=>new HugeCubeModel([3,4,5]).apply([{axis:'X',layer:1,turns:1}]),/截面/);
assert.throws(()=>max.apply([{axis:'X',layer:0,turns:1},{axis:'Y',layer:0,turns:1}]),/同一个轴/);
assert.throws(()=>HugeCubeModel.restore({...max.snapshot(),turns:[{axis:'X',layer:MAX_DIMENSION,turns:2}]}),/层号/);
console.log('PASS: lazy colors match every explicit sticker after random turns, painting, black masks, grouped restoration and undo; exact BigInt counts, coordinate round trips and turns at maximum dimensions; invalid input rejected before allocation.');
