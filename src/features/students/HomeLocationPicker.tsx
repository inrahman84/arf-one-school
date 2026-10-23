import React,{useEffect,useRef} from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props={latitude:number|null;longitude:number|null;onChoose:(lat:number,long:number)=>void;disabled?:boolean};
/** Map pointer selection, not device geolocation. Coordinates are stored only after a click/drag. */
export const HomeLocationPicker:React.FC<Props>=({latitude,longitude,onChoose,disabled=false})=>{
 const container=useRef<HTMLDivElement|null>(null);
 const map=useRef<L.Map|null>(null);
 const marker=useRef<L.CircleMarker|null>(null);
 const callback=useRef(onChoose);
 useEffect(()=>{callback.current=onChoose},[onChoose]);
 useEffect(()=>{
  if(!container.current||map.current)return;
  const initial: L.LatLngExpression =
    latitude!==null&&longitude!==null?[latitude,longitude]:[-2.5,117.5];
  const m=L.map(container.current,{center:initial,zoom:latitude!==null&&longitude!==null?15:5,
    zoomControl:true,attributionControl:true,scrollWheelZoom:false});
  map.current=m;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
  }).addTo(m);
  const update=(ll:L.LatLng)=>{
    if(!marker.current)marker.current=L.circleMarker(ll,{radius:9,color:'#073b2d',
      weight:3,fillColor:'#c89b55',fillOpacity:0.9}).addTo(m);
    else marker.current.setLatLng(ll);
  };
  if(latitude!==null&&longitude!==null)update(L.latLng(latitude,longitude));
  m.on('click',(event:L.LeafletMouseEvent)=>{
    const lat=Number(event.latlng.lat.toFixed(7)),lng=Number(event.latlng.lng.toFixed(7));
    update(event.latlng);
    callback.current(lat,lng);
  });
  // Leaflet needs an invalidateSize after mount; microtask avoids an extra timer.
  queueMicrotask(()=>m.invalidateSize());
  return ()=>{marker.current=null;map.current=null;m.remove()};
 },[]);
 useEffect(()=>{
  if(!map.current)return;
  if(latitude!==null&&longitude!==null){
    const ll=L.latLng(latitude,longitude);
    if(!marker.current)marker.current=L.circleMarker(ll,{radius:9,color:'#073b2d',
      fillColor:'#c89b55',fillOpacity:.9}).addTo(map.current);
    else marker.current.setLatLng(ll);
  }else if(marker.current){marker.current.remove();marker.current=null}
 },[latitude,longitude]);
 return <div className="space-y-2">
   <p className="text-xs text-gray-600">Geser/zoom peta, lalu klik <strong>titik rumah peserta didik</strong>. Koordinat Lintang dan Bujur terisi otomatis berdasarkan titik yang dipilih, bukan lokasi perangkat Anda.</p>
   <div ref={container} role="application" aria-label="Peta penentuan koordinat rumah"
     className={'h-64 w-full rounded-xl border border-gray-300 '+(disabled?'pointer-events-none opacity-50':'')}/>
   <p className="text-[11px] text-gray-500">Peta menggunakan layanan ubin OpenStreetMap. Tampilan peta menghubungi penyedia ubin eksternal. Hindari membuka detail rumah tanpa persetujuan/otorisasi yang sesuai.</p>
 </div>;
};
