(function(root) {
  const faces = ['U','R','F','D','L','B'];
  const names = {U:'上',R:'右',F:'前',D:'下',L:'左',B:'后'};
  const turns = {R:{axis:'X',layer:1,css:90},L:{axis:'X',layer:-1,css:-90},U:{axis:'Y',layer:1,css:-90},D:{axis:'Y',layer:-1,css:90},F:{axis:'Z',layer:1,css:90},B:{axis:'Z',layer:-1,css:-90}};
  function parity(a) { let n=0; for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])n++; return n%2; }
  function validate(text, Cube) {
    if(text.length!==54 || /[^URFDLB]/.test(text)) throw Error('还有未填写的方格，请补齐六个面。');
    for(const f of faces) if([...text].filter(x=>x===f).length!==9) throw Error('每种颜色必须恰好 9 格，请检查颜色计数。');
    if(faces.some((f,i)=>text[i*9+4]!==f)) throw Error('中心颜色不匹配，请检查六面的方向。');
    const c=Cube.fromString(text);
    if(new Set(c.cp).size!==8 || new Set(c.ep).size!==12 || c.asString()!==text) throw Error('色块组合不符合真实魔方，请检查相邻面方向和角块、棱块的颜色。');
    if(c.co.reduce((a,b)=>a+b,0)%3) throw Error('角块朝向不合法：可能有角块被单独扭转，或填色方向有误。');
    if(c.eo.reduce((a,b)=>a+b,0)%2) throw Error('棱块朝向不合法：可能有一条棱被翻转，或填色方向有误。');
    if(parity(c.cp)!==parity(c.ep)) throw Error('块的位置不合法：可能有两块被互换，请核对填色或实物装配。');
    return c;
  }
  function geometry(face,index) {
    const r=Math.floor(index/3),c=index%3;
    return {F:{p:[c-1,1-r,1],n:[0,0,1],rot:''},B:{p:[1-c,1-r,-1],n:[0,0,-1],rot:'rotateY(180deg)'},R:{p:[1,1-r,1-c],n:[1,0,0],rot:'rotateY(90deg)'},L:{p:[-1,1-r,c-1],n:[-1,0,0],rot:'rotateY(-90deg)'},U:{p:[c-1,1,r-1],n:[0,1,0],rot:'rotateX(90deg)'},D:{p:[c-1,-1,1-r],n:[0,-1,0],rot:'rotateX(-90deg)'}}[face];
  }
  function describe(move) {
    const f=move[0],t=turns[f],amount=move.endsWith('2')?2:move.endsWith("'")?-1:1;
    return {...t,face:f,amount,title:`${t.axis} 轴 · ${names[f]}层 · ${Math.abs(amount)===2?'180°':amount<0?'逆时针 90°':'顺时针 90°'}`,detail:`正对${names[f]}面（${f}）观察，只转动${names[f]}侧一层。`};
  }
  const api={faces,names,turns,validate,geometry,describe};
  if(typeof module!=='undefined')module.exports=api;else root.CubeCore=api;
})(typeof self!=='undefined'?self:globalThis);
