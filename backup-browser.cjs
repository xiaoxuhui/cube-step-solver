const assert=require('node:assert/strict');
const {chromium}=require('D:/soft/game-hub/node_modules/playwright');
process.env.CUBE_PORT='4398';const server=require('./server.cjs');
(async()=>{await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.addInitScript(()=>{window.GameHubBridge={saveFile:(name,data)=>{window.savedBackup={name,data};return true}}});await page.goto('http://127.0.0.1:4398/');
await page.locator('#backup-export').click();const backup=await page.evaluate(()=>window.savedBackup);assert.equal(backup.name,'cube-step-backup.json');const before=await page.evaluate(()=>localStorage.getItem('cube-step-v1'));
await page.locator('#backup-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('未能导入'));assert.equal(await page.evaluate(()=>localStorage.getItem('cube-step-v1')),before);
const nav=page.waitForEvent('load');await page.locator('#backup-import').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(backup.data)});await nav;assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cube-step-v1')).dimensions.join(',')),'3,3,3');assert.deepEqual(errors,[]);console.log('PASS: bridge export, invalid import preservation, valid import and reload');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
