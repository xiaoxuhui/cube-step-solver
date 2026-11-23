const assert=require('node:assert/strict');
const Cube=require('./dist/vendor/cube');
require('./dist/vendor/solve');
const {faces,turns,validate,geometry,validatePattern,isPatternSolved,completePattern,applyMove,shortPatternSolution}=require('./dist/core');
const solved=new Cube().asString();
assert.equal(validate(solved,Cube).isSolved(),true);
assert.throws(()=>validate(solved.slice(1),Cube),/未填写/);
assert.throws(()=>validate(solved.replace('U','R'),Cube),/9 格/);
const swapped=(indices)=>{const a=[...solved];const v=indices.map(i=>a[i]);indices.forEach((index,i)=>a[index]=v[(i+1)%v.length]);return a.join('');};
assert.throws(()=>validate(swapped([5,10]),Cube),/棱块朝向/);
assert.throws(()=>validate(swapped([8,9,20]),Cube),/角块朝向/);
const parity=[...solved];[parity[10],parity[19]]=[parity[19],parity[10]];
assert.throws(()=>validate(parity.join(''),Cube),/位置不合法/);

// Independently rotate sticker positions and normals to check all animated layers.
const key=(p,n)=>p.join(',')+'|'+n.join(',');
const geom=faces.flatMap(f=>Array.from({length:9},(_,j)=>geometry(f,j)));
const lookup=new Map(geom.map((g,i)=>[key(g.p,g.n),i]));
function rotate(v,axis,angle){const [x,y,z]=v,s=Math.sin(angle),c=Math.cos(angle);return (axis==='X'?[x,y*c-z*s,y*s+z*c]:axis==='Y'?[x*c+z*s,y,-x*s+z*c]:[x*c-y*s,x*s+y*c,z]).map(x=>Math.round(x));}
for(const f of faces){
  const t=turns[f],axis={X:0,Y:1,Z:2}[t.axis],a=-Math.PI/2*t.layer,out=[...solved];
  geom.forEach((g,i)=>{if(g.p[axis]!==t.layer)return;const p=rotate(g.p,t.axis,a),n=rotate(g.n,t.axis,a),dest=lookup.get(key(p,n));assert.notEqual(dest,undefined);out[dest]=solved[i];});
  assert.equal(out.join(''),new Cube().move(f).asString(),f+' geometry must match cube moves');
  const expectedCss=(t.axis==='Y'?1:-1)*(-90*t.layer);assert.equal(t.css,expectedCss,f+' animation direction');
}

console.time('solver initialization');Cube.initSolver();console.timeEnd('solver initialization');
for(let i=0;i<16;i++){
  // Use arbitrary random legal states rather than reversing a known scramble.
  const original=Cube.random(),text=original.asString(),cube=validate(text,Cube),alg=cube.solve().trim(),moves=alg?alg.split(/\s+/):[];
  for(const move of moves){cube.move(move);validate(cube.asString(),Cube);}
  assert(cube.isSolved(),'random state '+i+' must solve');
  for(const move of [...moves].reverse())cube.move(Cube.inverse(move));
  assert.equal(cube.asString(),text,'step undo must recover original state');
}
console.log('PASS: invalid states, 6 axis/layer geometries, 16 random solves and step-by-step undo.');

const allBlack=[...solved].map((c,i)=>i%9===4?c:'*').join('');
assert(isPatternSolved(allBlack));
assert.deepEqual(shortPatternSolution(allBlack),[]);
assert(completePattern(allBlack,Cube).isSolved());
assert.throws(()=>validatePattern(allBlack.replace('*','?'),Cube),/未填写/);
assert.throws(()=>validatePattern('U'.repeat(10)+allBlack.slice(10),Cube),/中心|超过/);
const invalidPartial=[...swapped([5,10])];invalidPartial[0]='*';
assert.throws(()=>completePattern(invalidPartial.join(''),Cube),/无法通过真实魔方/);
for(const f of faces)for(const suffix of ['',"'",'2']){
  const c=Cube.random();assert.equal(applyMove(c.asString(),f+suffix),c.move(f+suffix).asString());
  const partial=[...solved].map((v,i)=>i%9===4||i%4===0?v:'*').join('');
  const mixed=applyMove(partial,f+suffix),answer=shortPatternSolution(mixed);
  assert(answer&&answer.length===1);
  assert(isPatternSolved(answer.reduce(applyMove,mixed)));
  assert.equal(applyMove(mixed,Cube.inverse(f+suffix)),partial);
}
for(let i=0;i<48;i++){
  const original=Cube.random().asString(),chance=[.15,.5,.9][i%3];
  const partial=[...original].map((c,j)=>j%9!==4&&Math.random()<chance?'*':c).join('');
  const cube=completePattern(partial,Cube);
  assert([...partial].every((c,j)=>c==='*'||c===cube.asString()[j]));
  const moves=cube.solve().trim().split(/\s+/).filter(Boolean);
  let state=partial;
  for(const move of moves){state=applyMove(state,move);assert.equal([...state].filter(c=>c==='*').length,[...partial].filter(c=>c==='*').length);}
  assert(isPatternSolved(state),'partial targets must solve');
  for(const move of [...moves].reverse())state=applyMove(state,Cube.inverse(move));
  assert.equal(state,partial,'black stickers must return to their original positions on undo');
}
console.log('PASS: black wildcard completion, 18 one-turn partial goals, impossible masked input, 48 random partial solves and exact mask undo.');

const {CuboidModel}=require('./dist/cuboid');
assert.throws(()=>new CuboidModel([0,3,3]),/1 到 100/);
assert.throws(()=>new CuboidModel([2.5,3,3]),/1 到 100/);
assert.throws(()=>new CuboidModel([3,101,3]),/1 到 100/);
for(let x=1;x<=7;x++)for(let y=1;y<=7;y++)for(let z=1;z<=7;z++){
  const m=new CuboidModel([x,y,z]);assert.equal(m.cells.length,2*(x*y+x*z+y*z));
  assert.equal(m.positions.size,m.cells.length,'surface geometry must have unique positions');
  for(const axis of ['X','Y','Z']){
    const move={axis,layer:0,turns:2},permutation=m.permutation(move);
    assert.equal(new Set(permutation).size,m.cells.length,'every legal turn must permute all stickers');
    assert.equal(m.apply(m.apply(m.solved,move),move),m.solved,'half-turn inverse');
    if(!m.square(axis))assert.throws(()=>m.apply(m.solved,{...move,turns:1}),/只能旋转 180/);
  }
}
const classic=new CuboidModel();
for(const face of faces)for(const suffix of ['',"'",'2']){
  const text=Cube.random().asString();assert.equal(classic.apply(text,face+suffix),new Cube(Cube.fromString(text)).move(face+suffix).asString());
}
for(const dims of [[1,1,1],[1,2,3],[2,2,2],[2,3,4],[3,4,3],[4,4,4],[7,6,5],[7,7,7]]){
  const m=new CuboidModel(dims);
  for(const move of m.legalMoves())assert.equal(m.apply(m.apply(m.solved,move),m.inverse(move)),m.solved);
  const {state,moves}=m.scramble(),masked=[...state].map((c,i)=>i%3===0?'*':c).join('');
  const answer=m.knownSolution(masked,moves);assert(answer);assert(m.isSolved(answer.reduce((s,move)=>m.apply(s,move),masked)));
  assert.equal(m.knownSolution(state,[{axis:'X',layer:99,turns:2}]),null,'invalid stored history must be rejected');
  const move=m.legalMoves()[0],one=m.apply(m.solved,move),short=m.shortSolve(one,1);assert(short);assert(m.isSolved(short.reduce((s,t)=>m.apply(s,t),one)));
}
console.log('PASS: all 343 supported dimensions, valid surface permutations and cuboid turn restrictions, classic compatibility, generated masked restoration and shallow solving.');
const pocket=new CuboidModel([2,2,2]);
for(let i=0;i<12;i++){
  const {state}=pocket.scramble();
  const text=[...state].map((c,j)=>i%2&&j%4===0?'*':c).join('');
  const representative=completePattern(pocket.solverPattern(text),Cube),moves=representative.solve().trim().split(/\s+/).filter(Boolean);
  assert(pocket.isSolved(moves.reduce((s,move)=>pocket.apply(s,move),text)),'arbitrary 2x2 color solving');
}
console.log('PASS: 12 independent 2x2 full and masked color solves.');

let randomSeed=73647;const seededRandom=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
for(const dims of [[3,3,3],[2,3,4],[7,7,7]]){
  const m=new CuboidModel(dims),n=Math.max(...dims),min=Math.max(12,6*n),max=Math.max(24,12*n);
  assert.equal(m.randomScrambleLength(()=>0),min);
  assert.equal(m.randomScrambleLength(()=>1-Number.EPSILON),max);
  const lengths=new Set(),states=new Set();
  for(let i=0;i<10;i++){
    const result=m.scramble(undefined,seededRandom);lengths.add(result.moves.length);states.add(result.state);
    assert(result.moves.length>=min&&result.moves.length<=max);
    let state=m.solved;for(const move of result.moves)state=m.apply(state,move);assert.equal(state,result.state);
    const masked=[...state].map((c,j)=>j%5===0?'*':c).join('');
    const answer=m.knownSolution(masked,result.moves);assert(answer);assert(m.isSolved(answer.reduce((s,move)=>m.apply(s,move),masked)));
  }
  assert(lengths.size>1,'seeded random scrambles must vary in length');assert(states.size>1,'random scrambles must vary in state');
}
console.log('PASS: random length endpoints, varied lengths and states, and verified masked restoration for 30 seeded scrambles.');

for(const dims of [[7,7,7],[12,11,10],[30,30,30],[100,100,100],[1,50,100]]){
  const m=new CuboidModel(dims);assert.equal(m.cells.length,2*(dims[0]*dims[1]+dims[0]*dims[2]+dims[1]*dims[2]));
  const move=m.legalMoves()[0],changed=m.apply(m.solved,move);assert.equal(m.apply(changed,m.inverse(move)),m.solved);
  const sparse=m.sparsePermutation(move);assert(sparse.to.length<=m.cells.length);
  if(Math.max(...dims)===100&&dims[0]===100)assert(sparse.to.length<m.cells.length/4,'large turns must store only affected stickers');
}
const mathModel=new CuboidModel([7,7,7]);
const A={axis:'X',layer:0,turns:1},B={axis:'X',layer:1,turns:1},C={axis:'Y',layer:0,turns:1};
assert.deepEqual(mathModel.simplifyMoves([A,B,mathModel.inverse(A)]),[B],'same-axis disjoint layers commute');
assert.deepEqual(mathModel.simplifyMoves([A,C,mathModel.inverse(C),mathModel.inverse(A)]),[],'nested inverse blocks cancel');
const oneTurnState=mathModel.apply(mathModel.solved,A),searchAnswer=mathModel.findSolution(oneTurnState,null);assert.equal(searchAnswer.method,'置换搜索');assert(mathModel.isSolved(searchAnswer.moves.reduce((s,m)=>mathModel.apply(s,m),oneTurnState)));
for(let i=0;i<8;i++){
  const {state,moves}=mathModel.scramble(undefined,seededRandom),masked=[...state].map((c,j)=>j%3===0?'*':c).join('');
  const found=mathModel.findSolution(masked,moves);assert(found);assert(found.moves.length<=moves.length);assert(mathModel.isSolved(found.moves.reduce((s,m)=>mathModel.apply(s,m),masked)));
}
console.log('PASS: dimensions up to 100, sparse turns, permutation group cancellation, state-only search and verified high-order optimized solutions.');
