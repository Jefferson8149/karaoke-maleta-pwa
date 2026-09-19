const fs=require('fs'), path=require('path');
const root=path.resolve(process.argv[2]||'.');
const editions=['licensed','free'];
for(const edition of editions){
  const dir=path.join(root,edition);
  const pkgPath=path.join(dir,'package.json');
  const d=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
  d.version='0.10.36';
  d.licenseMode=edition==='free'?'free':'licensed';
  if(edition==='licensed'){
    d.build.appId='com.karaokemaleta.desktop';
    d.build.productName='Karaoke Maleta';
    d.build.artifactName='Karaoke_Maleta_Licenciado_Setup_${version}.${ext}';
    d.build.nsis.shortcutName='Karaoke Maleta';
  }else{
    d.build.appId='com.karaokemaleta.desktop.free';
    d.build.productName='Karaoke Maleta Livre';
    d.build.artifactName='Karaoke_Maleta_Livre_Setup_${version}.${ext}';
    d.build.nsis.shortcutName='Karaoke Maleta - Livre';
  }
  fs.writeFileSync(pkgPath,JSON.stringify(d,null,2)+'\n');

  const mainPath=path.join(dir,'main.js');
  let s=fs.readFileSync(mainPath,'utf8');
  if(!s.includes("const APP_EDITION")){
    s=s.replace("const licensing = require('./licensing');\n",
      "const licensing = require('./licensing');\n"+
      "const APP_EDITION = String(require('./package.json').licenseMode || 'licensed').toLowerCase();\n"+
      "const FREE_EDITION = APP_EDITION === 'free';\n"+
      "app.setPath('userData', path.join(app.getPath('appData'), 'Karaoke Maleta'));\n");
  }
  s=s.replace(
`ipcMain.handle('get-license-status', async()=>licensing.validateStoredLicenseOnline({allowGrace:true}));
ipcMain.handle('activate-license', async(e, code)=>{
  const result = await licensing.activateLicense(code);
  if(result.ok){setTimeout(()=>{startLicensedApp().catch(err=>console.error('Falha ao iniciar app licenciado:',err));},250);}
  return result;
});`,
`ipcMain.handle('get-license-status', async()=>{
  if(FREE_EDITION) return {ok:true,activated:true,freeEdition:true,machineId:licensing.getMachineId(),reason:'Edição Livre — licença não necessária.'};
  return licensing.validateStoredLicenseOnline({allowGrace:true});
});
ipcMain.handle('activate-license', async(e, code)=>{
  if(FREE_EDITION){setTimeout(()=>{startLicensedApp().catch(err=>console.error('Falha ao iniciar edição livre:',err));},100);return {ok:true,activated:true,freeEdition:true};}
  const result = await licensing.activateLicense(code);
  if(result.ok){setTimeout(()=>{startLicensedApp().catch(err=>console.error('Falha ao iniciar app licenciado:',err));},250);}
  return result;
});`);

  s=s.replace(
`async function enforceOnlineLicense(){
  const status=await licensing.validateStoredLicenseOnline({allowGrace:true});
  if(status.ok)return true;`,
`async function enforceOnlineLicense(){
  if(FREE_EDITION) return true;
  const status=await licensing.validateStoredLicenseOnline({allowGrace:true});
  if(status.ok)return true;`);

  s=s.replace(
`app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  const licenseStatus = await licensing.validateStoredLicenseOnline({allowGrace:true});
  if(licenseStatus.ok){
    await startLicensedApp();
    licenseRecheckTimer=setInterval(()=>enforceOnlineLicense().catch(()=>{}),30*60*1000);
  }else{
    createActivationWindow(licenseStatus.reason);
  }

  app.on('activate', async()=>{
    if(BrowserWindow.getAllWindows().length !== 0) return;
    const current = await licensing.validateStoredLicenseOnline({allowGrace:true});
    if(current.ok) await startLicensedApp();
    else createActivationWindow(current.reason);
  });
});`,
`app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  if(FREE_EDITION){
    await startLicensedApp();
  }else{
    const licenseStatus = await licensing.validateStoredLicenseOnline({allowGrace:true});
    if(licenseStatus.ok){
      await startLicensedApp();
      licenseRecheckTimer=setInterval(()=>enforceOnlineLicense().catch(()=>{}),30*60*1000);
    }else{
      createActivationWindow(licenseStatus.reason);
    }
  }

  app.on('activate', async()=>{
    if(BrowserWindow.getAllWindows().length !== 0) return;
    if(FREE_EDITION){ await startLicensedApp(); return; }
    const current = await licensing.validateStoredLicenseOnline({allowGrace:true});
    if(current.ok) await startLicensedApp();
    else createActivationWindow(current.reason);
  });
});`);
  fs.writeFileSync(mainPath,s);
}
