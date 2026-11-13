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
      o.innerHTML=`<form style="background:#f7f4ec;border-radius:16px;padding:26px;max-width:360px;width:100%;display:grid;gap:12px"><h1 style="margin:0;font-size:24px;color:#10243a">La Cigale Gestion</h1><p style="margin:0;color:#4b5a6b">${msg||'Connectez-vous pour accéder à vos données.'}</p><input name="email" type="email" required autocomplete="username" placeholder="Email" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><input name="pw" type="password" required autocomplete="current-password" placeholder="Mot de passe" style="padding:12px;border-radius:10px;border:1px solid #c9d2dc;font-size:16px"><button style="padding:12px;border-radius:10px;border:0;background:#2fb5c2;color:#fff;font-size:16px;font-weight:600;cursor:pointer">Se connecter</button><div id="cg-err" style="color:#b42318;min-height:18px;font-size:14px"></div></form>`;
      document.body.appendChild(o);
      const f=o.querySelector('form');
      f.onsubmit=async e=>{e.preventDefault();o.querySelector('button').disabled=true;
        const {error}=await sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.pw.value});
        if(error){o.querySelector('#cg-err').textContent=/invalid/i.test(error.message)?'Email ou mot de passe incorrect.':'Connexion impossible : '+error.message;o.querySelector('button').disabled=false;return}
        o.remove();res()};
    });
  }
  async function connect(){
    if(!ok)return false;
    sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
    window.__sb=sb;
    let {data}=await sb.auth.getSession().catch(()=>({data:{}}));
    if(!(data&&data.session)){
      if(!navigator.onLine){const c=ls.get('cg_email');if(!c)return false;userEmail=c;return true}
      await loginUI();({data}=await sb.auth.getSession());
    }
    userEmail=(data&&data.session&&data.session.user&&data.session.user.email)||ls.get('cg_email')||''; ls.set('cg_email',userEmail);
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
    const {data}=sb.storage.from('assets').getPublicUrl(id); return {id,url:data.publicUrl,sizeBytes:blob.size,contentType:blob.type}}};
  const user={id:async()=>userEmail.split('@')[0]||'moi',me:async()=>({id:userEmail,name:userEmail}),isOwner:()=>true,canEdit:()=>true};
  window.claude={use:async name=>{
    if(!ok)return null;
    if(!ready)ready=connect().then(async c=>{if(c)realtime();return c}).catch(e=>{console.error(e);return false});
    if(!(await ready))return null;
    return ({db,assets,user})[name]||null;
  }};
  window.CG_logout=async()=>{if(sb){await sb.auth.signOut();ls.set('cg_email','');location.reload()}};
  window.addEventListener('DOMContentLoaded',()=>{if(ok&&navigator.onLine)flush()});
})();
