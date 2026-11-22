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
