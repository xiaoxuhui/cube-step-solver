importScripts('vendor/cube.js', 'vendor/solve.js', 'core.js?v=allblack1');
importScripts('cuboid.js?v=centers1');
let initialized=false;
self.onmessage=event=>{
  const {text,id,dimensions=[3,3,3],history}=event.data;
  try {
    const model=new Cuboid.CuboidModel(dimensions);
    function sendSolution(moves,details={}){
      const groups=event.data.parallel?model.parallelGroups(moves):null;
      if(groups){let state=text;for(const group of groups)state=model.applyGroup(state,group);if(!model.isSolved(state))throw Error('并行还原方案验证失败，请重新计算。');}
      self.postMessage({id,kind:'result',moves,groups,...details});
    }
    if(event.data.action==='scramble'){
      const result=model.scramble();self.postMessage({id,kind:'scramble',state:result.state,moves:result.moves});return;
    }
    if(!model.classic&&!model.pocket){
      model.validate(text);
      self.postMessage({id,kind:'progress',message:'正在计算此尺寸的非黑色还原步骤…'});
      const result=model.findSolution(text,history);
      if(result===null)throw Error('搜索范围内未找到自填状态的解。此尺寸的随机生成状态可用打乱记录求解；二阶、三阶支持任意合法填色求解。');
      const {moves,method,baseline}=result;
      let state=text;for(const move of moves)state=model.apply(state,move);
      if(!model.isSolved(state))throw Error('未能验证还原方案，请重新计算。');
      sendSolution(moves,{method,baseline});return;
    }
    if(model.classic){
      model.validate(text);
      // Search all layers, so sparse goals and simple middle-slice turns stay short.
      const short=model.shortSolve(text,3,12000);
      if(short){sendSolution(short,{method:'置换搜索（含中间层）'});return;}
      self.postMessage({id,kind:'progress',message:'正在匹配中心朝向并计算三阶还原步骤…'});
      let candidate=null,lastError=null;
      for(const frame of model.centerFrames()){
        let state=text;for(const move of frame.moves)state=model.apply(state,move);
        if(CubeCore.faces.some((f,i)=>state[i*9+4]!==f&&state[i*9+4]!=='*'))continue;
        try{candidate={prefix:frame.moves,cube:CubeCore.completePattern(state,Cube)};break;}catch(error){lastError=error;}
      }
      if(!candidate)throw lastError||Error('当前中心颜色无法通过层转动匹配目标配色。中心格可以自由填写；请核对六面的目标颜色，或将不关心的中心涂黑。');
      if(!initialized){self.postMessage({id,kind:'progress',message:'正在准备求解器，首次使用需要几秒钟…'});Cube.initSolver();initialized=true;}
      const outer=candidate.cube.isSolved()?[]:candidate.cube.solve().trim().split(/\s+/).filter(Boolean),moves=[...candidate.prefix,...outer];
      let current=text,stop=0;while(!model.isSolved(current)&&stop<moves.length)current=model.apply(current,moves[stop++]);
      if(!model.isSolved(current))throw Error('三阶还原方案验证失败，请核对填色。');
      sendSolution(moves.slice(0,stop),{method:candidate.prefix.length?'中心朝向匹配＋二阶段求解':'二阶段求解'});return;
    }
    if(model.pocket)model.validate(text);
    const solverText=model.solverPattern(text);
    CubeCore.validatePattern(solverText,Cube);
    if(model.classic&&text.includes('*')){
      self.postMessage({id,kind:'progress',message:'正在寻找只还原非黑色格子的步骤…'});
      const short=CubeCore.shortPatternSolution(text);
      if(short){sendSolution(short,{method:'置换搜索'});return;}
    }
    const cube=CubeCore.completePattern(solverText,Cube);
    if(!initialized){self.postMessage({id,kind:'progress',message:'正在准备求解器，首次使用需要几秒钟…'});Cube.initSolver();initialized=true;}
    let moves=cube.isSolved()?[]:cube.solve().trim().split(/\s+/).filter(Boolean);
    let current=text,stop=0;
    while(!model.isSolved(current)&&stop<moves.length)current=model.apply(current,moves[stop++]);
    if(!model.isSolved(current))throw Error('未能得到有效还原方案，请重新计算。');
    moves=moves.slice(0,stop);
    sendSolution(moves,{method:'二阶段求解'});
  }catch(error){self.postMessage({id,kind:'error',message:error.message});}
};
