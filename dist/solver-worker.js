importScripts('vendor/cube.js', 'vendor/solve.js', 'core.js');
let initialized=false;
self.onmessage=event=>{
  const {text,id}=event.data;
  try {
    const cube=CubeCore.validate(text,Cube);
    if(!initialized){self.postMessage({id,kind:'progress',message:'正在准备求解器，首次使用需要几秒钟…'});Cube.initSolver();initialized=true;}
    const moves=cube.isSolved()?[]:cube.solve().trim().split(/\s+/).filter(Boolean);
    if(!cube.clone().move(moves.join(' ')).isSolved())throw Error('未能得到有效还原方案，请重新计算。');
    self.postMessage({id,kind:'result',moves});
  }catch(error){self.postMessage({id,kind:'error',message:error.message});}
};
