const fs=require('fs'), path=require('path');
const root=path.resolve(process.argv[2]||'.');
for(const edition of ['licensed','free']){
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

  if(!s.includes("const singleInstanceLock = app.requestSingleInstanceLock();")){
    s=s.replace(
      "app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');",
      "app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');\n\n"+
      "// Evita duas instâncias concorrentes e traz a já aberta para frente.\n"+
      "const singleInstanceLock = app.requestSingleInstanceLock();\n"+
      "if(!singleInstanceLock){ app.quit(); }\n"+
      "else{ app.on('second-instance',()=>{ const w=(operatorWin&&!operatorWin.isDestroyed())?operatorWin:((activationWin&&!activationWin.isDestroyed())?activationWin:null); if(w){try{if(w.isMinimized())w.restore();w.show();w.focus();}catch(e){}} }); }"
    );
  }

  if(!s.includes("function mediaLibraryConfigPath()")){
    s=s.replace(
      "function legacySessionFilePath(){\n  return path.join(__dirname,'data','session.json');\n}\n",
      "function legacySessionFilePath(){\n  return path.join(__dirname,'data','session.json');\n}\n"+
      "function mediaLibraryConfigPath(){ return path.join(app.getPath('userData'),'media-library.json'); }\n"+
      "function saveMediaLibraryPath(){ try{ fs.mkdirSync(path.dirname(mediaLibraryConfigPath()),{recursive:true}); fs.writeFileSync(mediaLibraryConfigPath(),JSON.stringify({path:String(state.mediaLibraryPath||'')},null,2),'utf8'); }catch(e){ console.error('Falha ao salvar pasta de músicas:',e); } }\n"+
      "function loadMediaLibraryPathFallback(){ try{ const p=mediaLibraryConfigPath(); if(fs.existsSync(p)){ const saved=JSON.parse(fs.readFileSync(p,'utf8')); if(!String(state.mediaLibraryPath||'').trim() && typeof saved.path==='string') state.mediaLibraryPath=saved.path; } }catch(e){} }\n"
    );
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
  if(!singleInstanceLock) return;
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

  s=s.replace(
    "      refreshMediaLibraryStatus();\n",
    "      loadMediaLibraryPathFallback();\n      refreshMediaLibraryStatus();\n"
  );
  s=s.replace(
    "  }catch(e){}\n}\n\nfunction sendState(){",
    "  }catch(e){}\n  loadMediaLibraryPathFallback();\n  refreshMediaLibraryStatus();\n}\n\nfunction sendState(){"
  );

  s=s.replace(
    "  state.mediaLibraryPath = r.filePaths[0];\n  resetMediaIndex();",
    "  state.mediaLibraryPath = r.filePaths[0];\n  saveMediaLibraryPath();\n  saveState();\n  resetMediaIndex();"
  );
  s=s.replace(
    "  state.mediaLibraryPath = '';\n  resetMediaIndex();",
    "  state.mediaLibraryPath = '';\n  saveMediaLibraryPath();\n  saveState();\n  resetMediaIndex();"
  );

  if(!s.includes("operatorWin.on('close'")){
    s=s.replace(
      "  operatorWin.webContents.on('did-finish-load', sendState);\n  tvWin.webContents.on('did-finish-load', sendState);\n\n  tvWin.on('close', (e)=>{",
      "  operatorWin.webContents.on('did-finish-load', sendState);\n  tvWin.webContents.on('did-finish-load', sendState);\n\n"+
      "  operatorWin.on('close', ()=>{\n"+
      "    if(!app.isQuitting){\n"+
      "      app.isQuitting=true;\n"+
      "      saveMediaLibraryPath();\n"+
      "      saveState();\n"+
      "      try{if(tvWin&&!tvWin.isDestroyed())tvWin.destroy();}catch(e){}\n"+
      "      try{if(activationWin&&!activationWin.isDestroyed())activationWin.destroy();}catch(e){}\n"+
      "      setImmediate(()=>app.quit());\n"+
      "    }\n"+
      "  });\n\n"+
      "  tvWin.on('close', (e)=>{"
    );
  }

  s=s.replace(
    "app.on('before-quit', ()=>{ app.isQuitting = true; });",
    "app.on('before-quit', ()=>{ app.isQuitting = true; saveMediaLibraryPath(); saveState(); try{mobileServer?.close?.();}catch(e){} try{secureServer?.close?.();}catch(e){} });"
  );

  fs.writeFileSync(mainPath,s);

  const opPath=path.join(dir,'app','operator.html');
  let o=fs.readFileSync(opPath,'utf8');
  const oldAdd=`async function add(song){
  const singer = prompt('Nome de quem vai cantar:','');
  if(singer === null) return;
  const singerName=(singer||'').trim()||'Pedido local';
  const singerId=singerName==='Pedido local'?'local-panel':'local-'+normalizeCatalogSearchText(singerName).replace(/[^a-z0-9]+/gi,'-');
  const r=await window.maleta.addCatalogToQueue({song,singer:singerName,singerId,requestedFrom:'operator'});
  if(!r?.ok){alert(r?.error||'Não foi possível adicionar esta música.');return;}
}`;
  const newAdd=`function askSingerName(defaultValue=''){
  return new Promise(resolve=>{
    document.getElementById('kmSingerPrompt')?.remove();
    const wrap=document.createElement('div');
    wrap.id='kmSingerPrompt';
    wrap.style.cssText='position:fixed;inset:0;z-index:9999;background:#000b;display:grid;place-items:center;padding:20px';
    wrap.innerHTML=\`<div style="width:min(440px,92vw);background:#0b0b0b;border:1px solid #665222;border-radius:18px;padding:20px;box-shadow:0 20px 70px #000"><h3 style="margin:0 0 8px">Adicionar à fila</h3><div class="small" style="margin-bottom:12px">Informe quem vai cantar. Você também pode deixar em branco.</div><input id="kmSingerPromptInput" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #665222;background:#111;color:#fff" placeholder="Nome do cantor"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button id="kmSingerCancel" class="ghost">Cancelar</button><button id="kmSingerOk" class="orange">Adicionar</button></div></div>\`;
    document.body.appendChild(wrap);
    const input=document.getElementById('kmSingerPromptInput'); input.value=defaultValue||''; input.focus(); input.select();
    let done=false; const finish=v=>{if(done)return;done=true;wrap.remove();resolve(v)};
    document.getElementById('kmSingerCancel').onclick=()=>finish(null);
    document.getElementById('kmSingerOk').onclick=()=>finish(input.value);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')finish(input.value);if(e.key==='Escape')finish(null)});
    wrap.addEventListener('click',e=>{if(e.target===wrap)finish(null)});
  });
}

async function add(song){
  if(!song?.code) return;
  const singer = await askSingerName('');
  if(singer === null) return;
  const singerName=(singer||'').trim()||'Pedido local';
  const singerId=singerName==='Pedido local'?'local-panel':'local-'+normalizeCatalogSearchText(singerName).replace(/[^a-z0-9]+/gi,'-');
  const r=await window.maleta.addCatalogToQueue({song,singer:singerName,singerId,requestedFrom:'operator'});
  if(!r?.ok){alert(r?.error||'Não foi possível adicionar esta música.');return;}
}`;
  if(o.includes(oldAdd)) o=o.replace(oldAdd,newAdd);

  const oldFull=`function addToQueueFromCatalog(code){
  const song=catalog.find(x=>String(x.code)===String(code));
  if(!song)return;
  const singer=prompt('Nome de quem vai cantar:','');
  if(singer===null)return;
  const singerName=(singer||'').trim()||'Pedido local';
  const singerId=singerName==='Pedido local'?'local-panel':'local-'+normalizeCatalogSearchText(singerName).replace(/[^a-z0-9]+/g,'-');
  queue.push({...song,singer:singerName,singerId,requestedFrom:'operator',reservationId:Date.now()+'-'+Math.random().toString(36).slice(2,7)});
  syncQueue();
}`;
  const newFull=`function addToQueueFromCatalog(code){
  const song=catalog.find(x=>String(x.code)===String(code));
  if(!song)return;
  add(song);
}`;
  if(o.includes(oldFull)) o=o.replace(oldFull,newFull);
  fs.writeFileSync(opPath,o);

  const tvPath=path.join(dir,'app','tv.html');
  let t=fs.readFileSync(tvPath,'utf8');
  t=t.replace('src="/assets/karaoke_maleta_logo.png" alt=""','src="/assets/waiting_screen_clean.jpg" alt=""');
  t=t.replace("idleBg.src=waitingUrl||'/assets/karaoke_maleta_logo.png';","idleBg.src=waitingUrl||'/assets/waiting_screen_clean.jpg';");
  fs.writeFileSync(tvPath,t);

  const cssPath=path.join(dir,'app','style.css');
  let c=fs.readFileSync(cssPath,'utf8');
  c += "\n/* v0.10.37 — tela de espera sem zoom/corte */\n.approvedIdle{background:#000!important;}\n.approvedIdleBg{object-fit:contain!important;object-position:center center!important;background:#000!important;}\n";
  fs.writeFileSync(cssPath,c);
}
