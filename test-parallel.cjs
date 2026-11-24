const assert=require('node:assert/strict');
const {CuboidModel}=require('./dist/cuboid');
const {LargeCubeView}=require('./dist/large-view');
const {planTransfers}=require('./dist/net-motion');
const classic=new CuboidModel();
assert.deepEqual(classic.parallelGroups(['R','L',"R'",'U','D']),[[{axis:'X',layer:0,turns:-1}],[{axis:'Y',layer:0,turns:-1},{axis:'Y',layer:2,turns:1}]]);
assert.deepEqual(classic.parallelGroups(['R','U',"U'","R'"]),[],'identity blocks must cancel without reordering across a nonidentity axis');
assert.equal(classic.parallelGroups(['R','U','L']).length,3,'different-axis boundaries must not be crossed');
assert.throws(()=>classic.applyGroup(classic.solved,['R','U']),/同一个旋转轴/);
for(const dims of [[3,3,3],[7,7,7],[13,13,13],[2,3,4],[200,200,200]]){
  const model=new CuboidModel(dims),text=[...model.solved].map((c,i)=>i%11===0?'*':c).join('');
  for(const axis of ['X','Y','Z']){
    const ai=model.axisIndex(axis),layers=[0,Math.floor(dims[ai]/2),dims[ai]-1],group=[...new Set(layers)].map((layer,i)=>({axis,layer,turns:model.square(axis)?[1,-1,2][i]:2}));
    const serial=group.reduce((s,move)=>model.apply(s,move),text),parallel=model.applyGroup(text,group);
    assert.equal(parallel,serial);assert.equal(model.applyGroup(text,[...group].reverse()),serial,'disjoint layers commute');
    assert.equal(model.applyGroup(parallel,model.inverseGroup(group)),text,'undo must revert the entire group, including black masks');
    const plan=planTransfers(model,group),copy=text.split('');for(const move of plan.transfers)copy[move.to]=text[move.from];assert.equal(copy.join(''),parallel);
    assert.equal(new Set(plan.transfers.map(t=>t.to)).size,plan.transfers.length,'no sticker can belong to two parallel layers');
    const turns=group.map(move=>({...model.describe(move),angle:0})),patches=LargeCubeView.buildPatches(model,turns,12,1);
    for(const patch of patches){const index=turns.findIndex(turn=>model.cells[patch.index].p[ai]===turn.coordinate);assert.equal(patch.moving,index>=0);if(patch.moving)assert.equal(patch.rotationIndex,index);}
  }
}
const m=new CuboidModel([7,7,7]),raw=[{axis:'X',layer:0,turns:1},{axis:'X',layer:6,turns:-1},{axis:'Y',layer:2,turns:1},{axis:'Z',layer:1,turns:2}];
for(let split=0;split<=raw.length;split++){
  const before=raw.slice(0,split),after=raw.slice(split),groups=[...m.parallelGroups(before),...m.parallelGroups(after)];
  assert.equal(groups.reduce((s,g)=>m.applyGroup(s,g),m.solved),raw.reduce((s,move)=>m.apply(s,move),m.solved),'regrouping at a paused boundary must preserve the entire plan');
}
console.log('PASS: same-axis grouping and cancellation, no cross-axis reorder, simultaneous/serial equivalence, whole-group undo, black masks, net transfers, multiple rotating layers up to 200 and regrouping at paused boundaries.');
