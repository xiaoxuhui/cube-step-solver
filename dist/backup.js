(function(root){
  'use strict';
  const keys=['cube-step-v1','cube-huge-v1','cube-huge-active'];
  function validate(text, normalModel, hugeModel){
    const data=JSON.parse(text);
    if(!data || data.format!=='cube-step-backup' || data.version!==1 || !data.values || typeof data.values!=='object' || Array.isArray(data.values)) throw Error('存档格式无效');
    if(Object.keys(data.values).some(k=>!keys.includes(k)) || keys.some(k=>!(k in data.values) || !(data.values[k]===null || typeof data.values[k]==='string'))) throw Error('存档字段无效');
    const normal=data.values['cube-step-v1'], huge=data.values['cube-huge-v1'], active=data.values['cube-huge-active'];
    if(active!==null && active!=='1') throw Error('模式记录无效');
    if(normal!==null){
      const v=JSON.parse(normal),dims=v?.dimensions||[3,3,3];
      if(!Array.isArray(dims)||dims.length!==3||dims.some(n=>!Number.isInteger(n)||n<1||n>200))throw Error('普通魔方尺寸无效');
      const model=new normalModel(dims),allowed=['w','r','g','y','o','b'];
      if(!Array.isArray(v.centers)||v.centers.length!==6||new Set(v.centers).size!==6||v.centers.some(c=>!allowed.includes(c))||!Array.isArray(v.stickers)||v.stickers.length!==model.cells.length||v.stickers.some(c=>c!==null&&c!=='k'&&!allowed.includes(c)))throw Error('普通魔方记录无效');
      if(v.history!==null && v.history!==undefined && (!Array.isArray(v.history)||v.history.length>10000||model.knownSolution(v.stickers.map(c=>c==='k'?'*':['U','R','F','D','L','B'][v.centers.indexOf(c)]||'?').join(''),v.history)===null))throw Error('转动记录无效');
    }
    if(huge!==null){
      const v=JSON.parse(huge);if(!v||!v.state)throw Error('超大魔方记录无效');const model=hugeModel.restore(v.state);
      if(v.centers!==undefined && (!Array.isArray(v.centers)||v.centers.length!==6||new Set(v.centers).size!==6||v.centers.some(c=>!['w','r','g','y','o','b'].includes(c))))throw Error('超大魔方配色无效');
      if(v.face!==undefined && !['U','R','F','D','L','B'].includes(v.face))throw Error('超大魔方面无效');
      if(v.row!==undefined || v.col!==undefined)model.checkCell(v.face||'F',v.row??0,v.col??0);
      if(v.prefs!==undefined && (!v.prefs||typeof v.prefs!=='object'||Array.isArray(v.prefs)))throw Error('超大魔方偏好无效');
    }
    if(active==='1' && huge===null)throw Error('缺少超大魔方记录');
    return data.values;
  }
  const api={keys,validate};if(typeof module!=='undefined')module.exports=api;
  if(!root.document)return;
  const status=root.document.getElementById('backup-status');
  root.document.getElementById('backup-export').addEventListener('click',()=>{
    try {const values=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));const text=JSON.stringify({format:'cube-step-backup',version:1,values},null,2);const name='cube-step-backup.json';
      if(typeof GameHubBridge!=='undefined'){status.textContent=GameHubBridge.saveFile(name,text)?'已受理，请选择保存位置；保存结果由大厅提示。':'无法受理导出，请重试。';return;}
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='已开始导出存档。';
    } catch {status.textContent='无法读取或导出存档；原数据未更改。';}
  });
  root.document.getElementById('backup-import').addEventListener('change',async event=>{
    const input=event.target,file=input.files[0];try{
      if(!file)return;if(file.size>16*1024*1024)throw Error('存档超过 16 MiB');
      const values=validate(await file.text(),root.Cuboid.CuboidModel,root.HugeCube.HugeCubeModel);
      if(!root.confirm('导入会替换当前魔方存档，请先导出备份。继续吗？'))return;
      const before=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
      const backupKey='cube-step-import-backup-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      localStorage.setItem(backupKey,JSON.stringify(before));
      try {for(const k of keys){if(values[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,values[k]);}}
      catch(error){for(const k of keys){try{if(before[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[k]);}catch{}}throw error;}
      root.location.reload();
    }catch(error){status.textContent='未能导入；导入前的存档备份已保留在本机（如备份无法创建则不会开始替换）。'+(error.message||'');}finally{input.value='';}
  });
})(typeof window!=='undefined'?window:globalThis);
