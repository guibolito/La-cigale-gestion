const V="cigale-web-27",F=["./","index.html","manifest.webmanifest","shim.js","vendor/chart.umd.js","vendor/jspdf.umd.min.js","vendor/xlsx.full.min.js","vendor/supabase.js","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))))});

self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch{}
 e.waitUntil(self.registration.showNotification(d.title||"La Cigale",{body:d.body||"",icon:"icons/icon-192.png",badge:"icons/icon-192.png",data:{url:d.url||"/"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.url)||"/";
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if("focus"in c)return c.focus()}return clients.openWindow(u)}))});
