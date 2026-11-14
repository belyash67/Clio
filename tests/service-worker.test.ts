import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {expect,it,vi} from "vitest";

it("service worker не перехватывает auth/API/POST и не кэширует личную навигацию",async()=>{
  const handlers=new Map<string,(event:Record<string,unknown>)=>void>();
  const match=vi.fn(async()=>new Response("offline"));const open=vi.fn();const fetcher=vi.fn(async()=>new Response("private page"));
  vm.runInNewContext(await readFile("public/sw.js","utf8"),{self:{location:{origin:"https://clio.test"},addEventListener:(name:string,handler:(e:Record<string,unknown>)=>void)=>handlers.set(name,handler)},caches:{match,open},fetch:fetcher,URL});
  const handle=handlers.get("fetch")!;
  for(const request of [{method:"GET",url:"https://clio.test/api/auth/get-session",mode:"cors"},{method:"POST",url:"https://clio.test/profile",mode:"navigate"}]){
    const respondWith=vi.fn();handle({request,respondWith});expect(respondWith).not.toHaveBeenCalled();
  }
  let response:Promise<Response>|undefined;
  handle({request:{method:"GET",url:"https://clio.test/profile",mode:"navigate"},respondWith:(r:Promise<Response>)=>{response=r;}});
  expect(await (await response!).text()).toBe("private page");expect(open).not.toHaveBeenCalled();expect(match).not.toHaveBeenCalled();
  fetcher.mockRejectedValueOnce(new Error("offline"));
  handle({request:{method:"GET",url:"https://clio.test/library",mode:"navigate"},respondWith:(r:Promise<Response>)=>{response=r;}});
  expect(await (await response!).text()).toBe("offline");expect(match).toHaveBeenCalledWith("/offline.html");expect(open).not.toHaveBeenCalled();
});
