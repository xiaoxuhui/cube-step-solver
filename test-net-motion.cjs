const assert=require('node:assert/strict');
const {CuboidModel}=require('./dist/cuboid');
const {planTransfers,pointAt}=require('./dist/net-motion');
for(const dims of [[3,3,3],[2,3,4],[13,13,13],[200,200,200]]){
  const model=new CuboidModel(dims),state=[...model.solved].map((c,i)=>i%7===0?'*':c).join('');
  const moves=dims.every(n=>n===3)?['R',"L'",'U2','D',"F'",'B2']:['X','Y','Z'].map(axis=>({axis,layer:Math.floor(model.dims[model.axisIndex(axis)]/2),turns:model.square(axis)?1:2}));
  for(const move of moves){
    const plan=planTransfers(model,move),out=state.split('');for(const t of plan.transfers){out[t.to]=state[t.from];assert(plan.faces.has(model.cells[t.from].face));assert(plan.faces.has(model.cells[t.to].face));}
    assert.equal(out.join(''),model.apply(state,move),'net animation destinations must match exact sticker permutation');
    assert.equal(new Set(plan.transfers.map(t=>t.from)).size,plan.transfers.length);assert.equal(new Set(plan.transfers.map(t=>t.to)).size,plan.transfers.length);
  }
}
const path={start:{x:1,y:0},end:{x:0,y:1},arc:{cx:0,cy:0,angle:Math.PI/2}};
assert.deepEqual(pointAt(path,0),path.start);assert.deepEqual(pointAt(path,1),path.end);
assert(Math.abs(pointAt(path,.5).x-Math.SQRT1_2)<1e-9);assert(Math.abs(pointAt(path,.5).y-Math.SQRT1_2)<1e-9);
const curve={start:{x:0,y:0},end:{x:10,y:10},control:{x:10,y:0}};assert.deepEqual(pointAt(curve,.5),{x:7.5,y:2.5});
console.log('PASS: net transfer destinations, affected faces and black masks across cube/cuboid/200-layer sizes, plus continuous arc and curve paths.');
