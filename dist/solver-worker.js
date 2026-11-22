importScripts('vendor/cube.js', 'vendor/solve.js', 'core.js?v=black1');
let initialized=false;
self.onmessage=event=>{
  const {text,id}=event.data;
  try {
    CubeCore.validatePattern(text,Cube);
    if(text.includes('*')){
      self.postMessage({id,kind:'progress',message:'正在寻找只还原非黑色格子的步骤…'});
      const short=CubeCore.shortPatternSolution(text);
      if(short){self.postMessage({id,kind:'result',moves:short});return;}
    }
    const cube=CubeCore.completePattern(text,Cube);
    if(!initialized){self.postMessage({id,kind:'progress',message:'正在准备求解器，首次使用需要几秒钟…'});Cube.initSolver();initialized=true;}
    let moves=cube.isSolved()?[]:cube.solve().trim().split(/\s+/).filter(Boolean);
    let current=text,stop=0;
    while(!CubeCore.isPatternSolved(current)&&stop<moves.length)current=CubeCore.applyMove(current,moves[stop++]);
    if(!CubeCore.isPatternSolved(current))throw Error('未能得到有效还原方案，请重新计算。');
    moves=moves.slice(0,stop);
    self.postMessage({id,kind:'result',moves});
  }catch(error){self.postMessage({id,kind:'error',message:error.message});}
};
