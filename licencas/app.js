const API_BASE='https://vicpani.com.br/licencas-api';
let authToken=sessionStorage.getItem('kmLicenseToken')||'';
let installPrompt=null,loadTimer=null;
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmtDate(v){if(!v)return 'Sem expiração';try{return new Date(v).toLocaleDateString('pt-BR')}catch{return v}}
function typeName(v){return ({lifetime:'Vitalícia','30d':'30 dias','1y':'1 ano',trial:'Teste — 7 dias',custom:'Personalizada'})[v]||v}
function notice(title,text,actions=null){
  $('#modalTitle').textContent=title||'Karaoke Maleta';
  $('#modalText').textContent=text||'';
  $('#modalActions').innerHTML=actions||'<button class="primary" onclick="closeModal()">OK</button>';
  $('#modal').classList.add('on');
}
function closeModal(){$('#modal').classList.remove('on')}
async function api(url,opt={}){
  const headers={'Content-Type':'application/json',...(opt.headers||{})};if(authToken)headers.Authorization='Bearer '+authToken;const r=await fetch(API_BASE+url,{...opt,headers});
  const x=await r.json().catch(()=>({}));
  if(r.status===401){showLogin();throw new Error('Sessão expirada')}
  if(!r.ok||x.ok===false)throw new Error(x.error||'Erro na operação');
  return x;
}
function showLogin(){$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden')}
function showApp(){$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');loadLicenses()}
async function login(){
  $('#loginError').textContent='';
  try{
    const x=await api('/login',{method:'POST',body:JSON.stringify({password:$('#password').value})});authToken=x.token||'';sessionStorage.setItem('kmLicenseToken',authToken);
    $('#password').value='';showApp();
  }catch(e){$('#loginError').textContent=e.message}
}
async function logout(){authToken='';sessionStorage.removeItem('kmLicenseToken');showLogin()}
async function boot(){
  try{if(!authToken){showLogin();return}try{await api('/session');showApp()}catch{showLogin()}}catch{showLogin()}
}
$$('nav button').forEach(b=>b.onclick=()=>{
  $$('nav button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  $$('.tab').forEach(x=>x.classList.remove('on'));$('#'+b.dataset.tab).classList.add('on');
  if(b.dataset.tab==='history')loadLicenses();
});
function toggleCustomDays(){$('#customDaysWrap').classList.toggle('hidden',$('#licenseType').value!=='custom')}
function clearForm(){['customer','machineId','notes'].forEach(id=>$('#'+id).value='');$('#licenseType').value='lifetime';toggleCustomDays();$('#resultCard').classList.add('hidden')}
async function generateLicense(){
  try{
    const x=await api('/licenses',{method:'POST',body:JSON.stringify({
      customer:$('#customer').value,machineId:$('#machineId').value,type:$('#licenseType').value,
      customDays:+$('#customDays').value,notes:$('#notes').value
    })});
    const l=x.license;
    $('#resultCustomer').textContent=l.customer;
    $('#resultMeta').textContent=`${typeName(l.type)} · ${l.machineId} · ${l.expiresAt?'Expira em '+fmtDate(l.expiresAt):'Sem expiração'}`;
    $('#licenseCode').value=l.licenseCode;
    $('#resultCard').classList.remove('hidden');
    $('#resultCard').scrollIntoView({behavior:'smooth',block:'start'});
    loadLicenses();
  }catch(e){notice('Karaoke Maleta',e.message)}
}
async function copyLicense(){
  await navigator.clipboard.writeText($('#licenseCode').value);
  notice('Karaoke Maleta','Licença copiada.');
}
async function shareLicense(){
  const text=$('#licenseCode').value;
  if(navigator.share){try{await navigator.share({title:'Karaoke Maleta — Licença',text});return}catch{}}
  await navigator.clipboard.writeText(text);notice('Karaoke Maleta','Licença copiada para compartilhar.');
}
function debouncedLoad(){clearTimeout(loadTimer);loadTimer=setTimeout(loadLicenses,300)}
async function loadLicenses(){
  if($('#appView').classList.contains('hidden'))return;
  try{
    const q=encodeURIComponent($('#search')?.value||''),status=encodeURIComponent($('#statusFilter')?.value||'all');
    const x=await api(`/licenses?q=${q}&status=${status}`);
    renderLicenses(x.licenses||[]);
  }catch(e){}
}
function renderLicenses(a){
  $('#licenseList').innerHTML=a.length?a.map(l=>`
  <div class="licenseItem">
    <div class="licenseItemTop">
      <div><div class="licenseCustomer">${esc(l.customer)}</div><div class="licenseMachine">${esc(l.machine_id)}</div></div>
      <span class="status ${l.status==='active'?'active':'revoked'}">${l.status==='active'?'ATIVA':'REVOGADA'}</span>
    </div>
    <div class="licenseDetails">
      <div><b>Tipo</b><br>${esc(typeName(l.license_type))}</div>
      <div><b>Criada</b><br>${esc(fmtDate(l.created_at))}</div>
      <div><b>Validade</b><br>${esc(fmtDate(l.expires_at))}</div>
    </div>
    <div class="licenseActions">
      <button onclick='copyExisting(${JSON.stringify(l.license_code)})'>Copiar</button>
      ${l.status==='active'?`<button class="danger" onclick='askRevoke(${JSON.stringify(l.id)},${JSON.stringify(l.customer)})'>Revogar</button>`:''}
    </div>
  </div>`).join(''):'<div class="card">Nenhuma licença encontrada.</div>';
}
async function copyExisting(code){await navigator.clipboard.writeText(code);notice('Karaoke Maleta','Licença copiada.')}
function askRevoke(id,customer){
  notice('Revogar licença',`Deseja revogar a licença de ${customer}?`,
    `<button class="danger" onclick='revokeLicense(${JSON.stringify(id)})'>Revogar</button><button onclick="closeModal()">Cancelar</button>`);
}
async function revokeLicense(id){
  closeModal();
  try{await api(`/licenses/${id}/revoke`,{method:'POST',body:JSON.stringify({reason:'Revogada pelo administrador'})});loadLicenses();notice('Karaoke Maleta','Licença revogada.')}catch(e){notice('Karaoke Maleta',e.message)}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').style.display='inline-block'});
window.addEventListener('appinstalled',()=>{$('#installBtn').style.display='none';installPrompt=null});
$('#installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else notice('Karaoke Maleta','Use o menu do navegador e escolha “Instalar app”.')};
if(matchMedia('(display-mode: standalone)').matches)$('#installBtn').style.display='none';
if('serviceWorker'in navigator)navigator.serviceWorker.register('/karaoke-maleta-pwa/licencas/sw.js').catch(()=>{});
boot();