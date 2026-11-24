const assert=require('node:assert/strict');
const {CuboidModel}=require('./dist/cuboid');
const {LargeCubeView}=require('./dist/large-view');
for(const dims of [[13,13,13],[25,25,25],[49,49,49],[100,100,100],[200,200,200],[13,17,25]]){
  const model=new CuboidModel(dims);
  for(const rotation of [null,model.describe({axis:'X',layer:0,turns:model.square('X')?1:2}),model.describe({axis:'Y',layer:Math.floor(dims[1]/2),turns:2})]){
    const patches=LargeCubeView.buildPatches(model,rotation,12,1);
    for(const face of ['U','R','F','D','L','B']){
      const [rows,cols]=model.shapes[face],coverage=new Uint8Array(rows*cols);
      for(const patch of patches.filter(p=>p.face===face)){
        const r=patch.range;
        for(let y=r.row;y<r.row+r.rows;y++)for(let x=r.col;x<r.col+r.cols;x++)coverage[y*cols+x]++;
        const span=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
        assert(Math.abs(span(patch.points[0],patch.points[1])-r.cols*2)<1e-8,'world width must match the exact number of texture columns, including edge patches');
        assert(Math.abs(span(patch.points[1],patch.points[2])-r.rows*2)<1e-8,'world height must match exact texture rows');
      }
      assert(coverage.every(n=>n===1),'all source stickers must be drawn once with no omitted or repeated edge cells');
    }
  }
}
for(const [source,target]of [
  [[[0,0],[10,0],[10,10]],[[2,3],[22,3],[22,33]]],
  [[[7,11],[34,13],[27,62]],[[73,91],[125,105],[66,177]]]
]){
  const m=LargeCubeView.triangleTransform(source,target);assert(m);
  source.forEach((p,i)=>{assert(Math.abs(m[0]*p[0]+m[2]*p[1]+m[4]-target[i][0])<1e-8);assert(Math.abs(m[1]*p[0]+m[3]*p[1]+m[5]-target[i][1])<1e-8);});
}
console.log('PASS: every real sticker covered once, uniform world-to-texture scale at all edges through 200 layers, rotating boundary coverage and exact texture projection.');
