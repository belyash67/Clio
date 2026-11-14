import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest {
  return {name:"Clio — Your stories. Your cinema.",short_name:"Clio",description:"Кинодневник, библиотека и друзья",start_url:"/",scope:"/",display:"standalone",background_color:"#111210",theme_color:"#111210",lang:"ru",icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/icons/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}]};
}
