const assert=require('node:assert/strict');
const {parseFace,formatFace}=require('./dist/color-input');
const {CuboidModel}=require('./dist/cuboid');
assert.deepEqual(parseFace('白 红,绿\n黄；橙|蓝/黑',7),['w','r','g','y','o','b','k']);
assert.deepEqual(parseFace('w3 R2 *2 ?2',9),['w','w','w','r','r','k','k',null,null]);
assert.equal(parseFace('K40000',40000).length,40000);
assert.throws(()=>parseFace('W40001',40000),/重复数量/);
assert.throws(()=>parseFace('W999999999999999999999999999',9),/重复数量/);
assert.throws(()=>parseFace('W0',9),/重复数量/);
assert.throws(()=>parseFace('W1.5',6),/无法识别/);
assert.throws(()=>parseFace('W8',9),/目前填写了 8 格/);
assert.throws(()=>parseFace('W9K',9),/数量过多/);
assert.throws(()=>parseFace('你好',9),/无法识别/);
const fixture=['w','r','g','y','o','b','k',null,'w'];assert.deepEqual(parseFace(formatFace(fixture,3),9),fixture);
const model=new CuboidModel([200,200,200]);assert.equal(model.cells.length,240000);
assert.equal(model.randomScrambleLength(()=>0),1200);assert.equal(model.randomScrambleLength(()=>1-Number.EPSILON),2400);
assert.throws(()=>new CuboidModel([201,2,3]),/1 到 200/);
for(const axis of ['X','Y','Z']){
  const move={axis,layer:99,turns:1};assert.equal(model.apply(model.apply(model.solved,move),model.inverse(move)),model.solved);
}
const small=new CuboidModel([4,4,4]);let seed=14791;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const long=small.scramble(2201,random),answer=small.knownSolution(long.state,long.moves);assert(answer);assert(small.isSolved(answer.reduce((state,move)=>small.apply(state,move),long.state)));
console.log('PASS: manual Chinese/letter/RLE colors and invalid input, 200x200x200 with 240000 stickers, boundary turns, and histories beyond 2000 moves.');
