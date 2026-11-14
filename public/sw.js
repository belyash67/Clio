/* Cache only the public offline page and icons. Never cache accounts, API or navigated pages. */
const SHELL="clio-shell-v1";
const FILES=["/offline.html","/icons/icon-192.png","/icons/icon-512.png","/icons/maskable-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("clio-shell-")&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE_UPDATE")self.skipWaiting();});
self.addEventListener("fetch",event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate")event.respondWith(fetch(request).catch(()=>caches.match("/offline.html")));
  else if(FILES.includes(url.pathname))event.respondWith(caches.match(request).then(saved=>saved||fetch(request)));
});
