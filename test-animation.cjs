const assert=require('node:assert/strict');
const {CuboidModel}=require('./dist/cuboid');
const {LargeCubeView}=require('./dist/large-view');
const {buildPatches,rotate}=LargeCubeView;
const near=(a,b)=>assert(a.every((x,i)=>Math.abs(x-b[i])<1e-7),JSON.stringify(a)+' != '+JSON.stringify(b));
for(const dims of [[13,13,13],[13,14,15]]){
  const model=new CuboidModel(dims);
  for(const axis of ['X','Y','Z'])for(const layer of [0,Math.floor(dims[model.axisIndex(axis)]/2),dims[model.axisIndex(axis)]-1])for(const turns of model.square(axis)?[1,-1,2]:[2]){
    const move={axis,layer,turns},info=model.describe(move),patches=buildPatches(model,info,100),p=model.sparsePermutation(move),target=new Map();
    for(let i=0;i<p.from.length;i++)target.set(p.from[i],p.to[i]);
    assert.equal(patches.length,model.cells.length);
    assert.equal(patches.filter(p=>p.moving).length,model.layers[model.axisIndex(axis)][layer].length);
    for(const patch of patches){
      const cell=model.cells[target.get(patch.index)??patch.index],expected=cell.p.map((x,i)=>x+cell.n[i]);expected[1]*=-1;
      const center=[0,1,2].map(i=>patch.points.reduce((s,p)=>s+p[i],0)/4);
      near(patch.moving?rotate(center,axis,info.css):center,expected);
      const expectedNormal=[cell.n[0],-cell.n[1],cell.n[2]];
      near(patch.moving?rotate(patch.normal,axis,info.css):patch.normal,expectedNormal);
    }
  }
}
const large=new CuboidModel([100,100,100]);
for(const axis of ['X','Y','Z'])for(const layer of [0,49,99]){
  const info=large.describe({axis,layer,turns:1}),patches=buildPatches(large,info),ai=large.axisIndex(axis);
  assert(patches.length<4500,'animation geometry must stay bounded for 100x100x100');
  assert(patches.some(p=>p.moving));
  for(const patch of patches){
    assert.equal(patch.moving,large.cells[patch.index].p[ai]===info.coordinate,'selected thin layers must be kept in sampled geometry');
    if(!patch.moving){
      const sign=ai===1?-1:1,coordinates=patch.points.map(p=>p[ai]*sign-large.cells[patch.index].n[ai]);
      assert(!(Math.min(...coordinates)<info.coordinate&&Math.max(...coordinates)>info.coordinate),'stationary patches cannot contain the moving layer');
    }
  }
}
console.log('PASS: canvas rotation endpoints match exact sticker permutations for all axes, directions and layers; 100x100x100 sampling isolates thin moving layers.');
