/* Pont entre l'appli et Supabase : fournit window.claude.use('db' | 'assets' | 'user' | 'downloads')
   avec la même API que l'artifact, pour que l'appli fonctionne sans modification. */
(function(){
  const cfg=window.CG_CONFIG||{}, ok=cfg.url&&cfg.key&&window.supabase&&!/^__/.test(cfg.url);
  let sb=null, ready=null, userEmail='';
  const store={}, subs=[], LS=k=>'cgdb_'+k;
  const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
  const say=m=>{try{(0,eval)('toast')(m)}catch{console.warn(m)}};
  /* ---------- connexion ---------- */
  function loginUI(msg){
    return new Promise(res=>{
      let o=document.getElementById('cg-login'); if(o)o.remove();
      o=document.createElement('div'); o.id='cg-login';
      o.style.cssText='position:fixed;inset:0;z-index:99999;background:#10243a;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Barlow,system-ui,sans-serif';
      o.innerHTML=`<form style="background:#f7f4ec;border-radius:16px;padding:26px;max-width:360px;width:100%;display:grid;gap:12px"><h1 style="margin:0;font-size:24px;color:#10243a">La Cigale Gestion</h1><p style="margin:0;color:#4b5a6b">${msg||'Connectez-vous pour accéder à vos données.'}</p><input name="email" type="email" required autocomplete="username" placeholder="Email" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><input name="pw" type="password" required autocomplete="current-password" placeholder="Mot de passe" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><button style="padding:12px;border-radius:10px;border:0;background:#2fb5c2;color:#fff;font-size:16px;font-weight:600;cursor:pointer">Se connecter</button><div id="cg-err" style="color:#b42318;min-height:18px;font-size:14px"></div><a href="#" id="cg-forgot" style="color:#1f8d99;font-size:14px;text-align:center">Mot de passe oublié ?</a></form>`;
      document.body.appendChild(o);
      const f=o.querySelector('form');
      f.onsubmit=async e=>{e.preventDefault();o.querySelector('button').disabled=true;
        const {error}=await sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.pw.value});
        if(error){o.querySelector('#cg-err').textContent=/invalid/i.test(error.message)?'Email ou mot de passe incorrect.':'Connexion impossible : '+error.message;o.querySelector('button').disabled=false;return}
        o.remove();res()};
      o.querySelector('#cg-forgot').onclick=async e=>{e.preventDefault();const em=f.email.value.trim(),er=o.querySelector('#cg-err');
        if(!em){er.style.color='#b42318';er.textContent='Saisissez d’abord votre email ci-dessus.';return}
        const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+'/'});
        er.style.color=error?'#b42318':'#16905f';er.textContent=error?'Envoi impossible : '+error.message:'Si ce compte existe, un email de réinitialisation vient d’être envoyé.'};
    });
  }
  /* changer / définir le mot de passe (aussi après un lien « mot de passe oublié ») */
  function pwUI(first){
    return new Promise(res=>{
      let o=document.getElementById('cg-pw'); if(o)o.remove();
      o=document.createElement('div'); o.id='cg-pw';
      o.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(16,36,58,.92);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Barlow,system-ui,sans-serif';
      o.innerHTML='<form style="background:#f7f4ec;border-radius:16px;padding:26px;max-width:360px;width:100%;display:grid;gap:12px"><h1 style="margin:0;font-size:22px;color:#10243a">'+(first?'Choisissez un nouveau mot de passe':'Changer mon mot de passe')+'</h1><p style="margin:0;color:#4b5a6b;font-size:14px">12 caractères minimum. Utilisez un gestionnaire de mots de passe.</p><input name="p1" type="password" required minlength="12" autocomplete="new-password" placeholder="Nouveau mot de passe" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><input name="p2" type="password" required minlength="12" autocomplete="new-password" placeholder="Répétez le mot de passe" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><button style="padding:12px;border-radius:10px;border:0;background:#2fb5c2;color:#fff;font-size:16px;font-weight:600">Enregistrer</button>'+(first?'':'<button type="button" id="cg-pw-x" style="padding:10px;border-radius:10px;border:1px solid #c9d2dc;background:#fff;font-size:15px">Annuler</button>')+'<div id="cg-pe" style="min-height:18px;font-size:14px;color:#b42318"></div></form>';
      document.body.appendChild(o); const f=o.querySelector('form'); const x=o.querySelector('#cg-pw-x'); if(x)x.onclick=()=>{o.remove();res(false)};
      f.onsubmit=async e=>{e.preventDefault(); const er=o.querySelector('#cg-pe');
        if(f.p1.value!==f.p2.value){er.textContent='Les deux mots de passe sont différents.';return}
        const {error}=await sb.auth.updateUser({password:f.p1.value});
        if(error){er.textContent='Impossible : '+error.message;return}
        o.remove(); say('Mot de passe modifié.'); res(true)};
    });
  }
  window.CG_changePw=()=>sb?pwUI(false):null;
  async function connect(){
    if(!ok)return false;
    const recovery=/type=recovery/.test(location.hash||'');
    sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
    window.__sb=sb;
    let {data}=await sb.auth.getSession().catch(()=>({data:{}}));
    if(!(data&&data.session)){
      if(!navigator.onLine){const c=ls.get('cg_email');if(!c)return false;userEmail=c;return true}
      await loginUI();({data}=await sb.auth.getSession());
    }
    userEmail=(data&&data.session&&data.session.user&&data.session.user.email)||ls.get('cg_email')||''; ls.set('cg_email',userEmail);
    if(recovery){try{history.replaceState(null,'',location.pathname)}catch{} await pwUI(true)}
    sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT')location.reload()});
    return true;
  }
  /* ---------- données ---------- */
  const isNet=e=>!e||/fetch|network|failed|timeout|offline/i.test(String(e.message||e))||e.status===0;
  const notify=(()=>{const t={};return col=>{if(t[col])return;t[col]=setTimeout(()=>{t[col]=0;subs.filter(s=>s.col===col).forEach(emit)},120)}})();
  function docsOf(col){return Object.entries(store[col]||{}).map(([id,d])=>({id,d}))}
  function snap(s){
    let l=docsOf(s.col);
    if(s.kind==='doc'){const x=l.find(y=>y.id===s.id);return {exists:!!x,data:()=>x?x.d:undefined,id:s.id}}
    if(s.order){const k=s.order[0],dir=s.order[1]==='desc'?-1:1;l.sort((a,b)=>String(a.d[k]||'')<String(b.d[k]||'')?-dir:dir)}
    if(s.limit)l=l.slice(0,s.limit);
    return {docs:l.map(x=>({id:x.id,data:()=>x.d}))};
  }
  const emit=s=>{try{s.cb(snap(s))}catch(e){console.error(e)}};
  const loaded={}, loading={};
  async function load(col){
    if(loaded[col])return; if(loading[col])return loading[col];
    return loading[col]=(async()=>{
      const out={}; let from=0;
      try{
        for(;;){const {data,error}=await sb.from('docs').select('id,data').eq('col',col).range(from,from+999);
          if(error)throw error; (data||[]).forEach(r=>out[r.id]=r.data); if(!data||data.length<1000)break; from+=1000}
        store[col]=out; ls.set(LS(col),out); loaded[col]=1;
      }catch(e){const c=ls.get(LS(col)); if(c){store[col]=c;loaded[col]=1}else{delete loading[col];throw e}}
    })();
  }
  /* sortie : écritures mises en file (hors connexion aussi) */
  let outbox=ls.get('cg_outbox')||[], flushing=false;
  const saveBox=()=>ls.set('cg_outbox',outbox);
  async function flush(){
    if(flushing||!sb)return; flushing=true;
    try{while(outbox.length){
      const o=outbox[0]; let error=null;
      try{ if(o.op==='set'){({error}=await sb.from('docs').upsert({col:o.col,id:o.id,data:o.data,updated_at:new Date().toISOString()},{onConflict:'col,id'}))}
           else {({error}=await sb.from('docs').delete().eq('col',o.col).eq('id',o.id))} }catch(e){error=e}
      if(error&&isNet(error))break;
      if(error){say(/duplicate|unique/i.test(error.message||'')?'Ce numéro existe déjà (créé en même temps par l’autre personne). Rechargez la page.':'Enregistrement refusé : '+(error.message||'erreur'));}
      outbox.shift(); saveBox();
    }}finally{flushing=false}
  }
  function queue(op){outbox=outbox.filter(o=>!(o.col===op.col&&o.id===op.id&&o.op===op.op));outbox.push(op);saveBox();flush()}
  function local(col,id,d){store[col]=store[col]||{}; if(d===null)delete store[col][id]; else store[col][id]=d; ls.set(LS(col),store[col])}
  function realtime(){
    sb.channel('cg-docs').on('postgres_changes',{event:'*',schema:'public',table:'docs'},p=>{
      const r=p.eventType==='DELETE'?p.old:p.new; if(!r||!r.col)return;
      if(!loaded[r.col])return; store[r.col]=store[r.col]||{};
      if(p.eventType==='DELETE')delete store[r.col][r.id]; else store[r.col][r.id]=r.data;
      ls.set(LS(r.col),store[r.col]); notify(r.col);
    }).subscribe();
    addEventListener('online',()=>{flush();Object.keys(loaded).forEach(c=>{loaded[c]=0;load(c).then(()=>notify(c)).catch(()=>{})})});
    setInterval(flush,15000);
  }
  const mkQuery=(col,id)=>({
    orderBy(k,dir){this._o=[k,dir||'asc'];return this}, limit(n){this._l=n;return this},
    onSnapshot(cb,err){const s={col,cb,kind:'col',order:this._o,limit:this._l};subs.push(s);load(col).then(()=>emit(s)).catch(e=>{if(err)err(e)});return()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}},
    doc(did){return {set:async d=>{local(col,did,d);queue({op:'set',col,id:did,data:d})},delete:async()=>{local(col,did,null);queue({op:'del',col,id:did})},
      onSnapshot(cb,err){const s={col,id:did,cb,kind:'doc'};subs.push(s);load(col).then(()=>emit(s)).catch(e=>{if(err)err(e)});return()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}}}
  });
  const db={
    collection:c=>mkQuery(c),
    doc(path){const [c,i]=path.split('/');return mkQuery(c).doc(i)}
  };
  const assets={async upload(blob){
    const ext=(blob.type||'').includes('pdf')?'pdf':(blob.type||'').includes('png')?'png':'jpg', id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2))+'.'+ext;
    const {error}=await sb.storage.from('assets').upload(id,blob,{contentType:blob.type||'application/octet-stream'}); if(error)throw error;
    return {id,url:'cgpriv:'+id,sizeBytes:blob.size,contentType:blob.type}}};
  const user={id:async()=>userEmail.split('@')[0]||'moi',me:async()=>({id:userEmail,name:userEmail}),isOwner:()=>true,canEdit:()=>true};
  window.claude={use:async name=>{
    if(!ok)return null;
    if(!ready)ready=connect().then(async c=>{if(c)realtime();return c}).catch(e=>{console.error(e);return false});
    if(!(await ready))return null;
    return ({db,assets,user})[name]||null;
  }};
  /* fichiers privés : les liens « cgpriv:<id> » sont remplacés par des liens signés temporaires */
  const signed={};
  async function sign(id){const c=signed[id]; if(c&&c.t>Date.now())return c.u;
    const {data,error}=await sb.storage.from('assets').createSignedUrl(id,3600); if(error||!data)return null; signed[id]={u:data.signedUrl,t:Date.now()+3000*1000}; return data.signedUrl}
  async function fixEl(el){const at=el.tagName==='A'?'href':'src', v=el.getAttribute(at)||''; if(v.indexOf('cgpriv:')!==0||!sb)return;
    const u=await sign(v.slice(7)); if(u)el.setAttribute(at,u)}
  function scan(root){(root.querySelectorAll?root.querySelectorAll('img[src^="cgpriv:"],a[href^="cgpriv:"]'):[]).forEach(fixEl); if(root.matches&&root.matches('img[src^="cgpriv:"],a[href^="cgpriv:"]'))fixEl(root)}
  new MutationObserver(m=>m.forEach(r=>{r.addedNodes.forEach(n=>n.nodeType===1&&scan(n)); if(r.type==='attributes')scan(r.target)})).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href']});
  window.CG_logout=async()=>{if(sb){await sb.auth.signOut();ls.set('cg_email','');location.reload()}};
  window.addEventListener('DOMContentLoaded',()=>{if(ok&&navigator.onLine)flush()});
})();
