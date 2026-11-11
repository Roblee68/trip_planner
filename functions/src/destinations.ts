import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export type VerifiedDestination = { id:string; label:string; latitude:number; longitude:number; country:string; region:string; kind:string };
const digest=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,32);
const clean=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,300):'';
export function destinationQuery(value:unknown):string{
  if(typeof value!=='string'||value.trim().length<3||value.trim().length>200||/[<>\x00-\x1f]/.test(value))throw new HttpsError('invalid-argument','Enter a place name, address or latitude and longitude.');
  return value.replace(/\s+/g,' ').trim();
}
export function coordinateDestination(query:string):Omit<VerifiedDestination,'id'>|null{
  const match=query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(!match)return null;
  const latitude=Number(match[1]),longitude=Number(match[2]);
  if(Math.abs(latitude)>90||Math.abs(longitude)>180)throw new HttpsError('invalid-argument','Latitude must be between −90 and 90; longitude between −180 and 180.');
  return {label:`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,latitude,longitude,country:'',region:'',kind:'coordinates'};
}
export function photonDestinations(raw:unknown):Omit<VerifiedDestination,'id'>[]{
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {features?:unknown}).features))return [];
  const output:Omit<VerifiedDestination,'id'>[]=[],seen=new Set<string>();
  for(const value of (raw as {features:unknown[]}).features.slice(0,10)){
    if(!value||typeof value!=='object')continue;
    const feature=value as {properties?:Record<string,unknown>;geometry?:{type?:string;coordinates?:unknown[]}};
    const p=feature.properties,g=feature.geometry;
    if(!p||g?.type!=='Point'||!Array.isArray(g.coordinates))continue;
    const [longitude,latitude]=g.coordinates;
    if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)continue;
    const street=[clean(p.housenumber),clean(p.street)].filter(Boolean).join(' ');
    const name=clean(p.name),city=clean(p.city)||clean(p.district)||clean(p.county);
    const pieces=[name,street===name?'':street,city===name?'':city,clean(p.state),clean(p.postcode),clean(p.country)].filter(Boolean);
    const label=pieces.join(', ').slice(0,300);
    if(!label||!p.osm_id||!p.osm_type||!clean(p.country))continue;
    const key=`${label}|${latitude}|${longitude}`;if(seen.has(key))continue;seen.add(key);
    output.push({label,latitude,longitude,country:clean(p.country),region:clean(p.state),kind:clean(p.osm_value)||'place'});
    if(output.length===5)break;
  }
  return output;
}

/** User-triggered only, privately cached and capped; never an AI call or keystroke autocomplete. */
export async function lookupDestinations(uid:string,value:unknown,now=new Date()):Promise<{results:VerifiedDestination[];attribution:string}>{
  const query=destinationQuery(value),db=getFirestore(),key=digest(`${uid}|${query.toLowerCase()}`);
  const ref=db.collection('destinationLookups').doc(key);
  const cached=(await ref.get()).data();
  if(cached&&Date.parse(cached.expiresAt)>now.getTime())return {results:cached.results,attribution:'© OpenStreetMap contributors · Photon'};
  const coordinate=coordinateDestination(query),day=now.toISOString().slice(0,10);
  await db.runTransaction(async tx=>{
    const user=db.collection('mapUsage').doc(`${uid}_${day}`),global=db.collection('mapUsage').doc(`global_${day}`),lock=db.collection('mapUsage').doc('provider_throttle');
    const [u,g,l]=await Promise.all([tx.get(user),tx.get(global),tx.get(lock)]);
    if(Number(u.data()?.count??0)>=20)throw new HttpsError('resource-exhausted','You’ve reached today’s 20 location lookups. Previously verified destinations remain available.');
    if(Number(g.data()?.count??0)>=300||(!coordinate&&now.getTime()-Number(l.data()?.calledAt??0)<1100))throw new HttpsError('resource-exhausted','Location lookup is busy. Please try again later. No AI action was used.');
    tx.set(user,{count:Number(u.data()?.count??0)+1,updatedAt:now.toISOString()});
    tx.set(global,{count:Number(g.data()?.count??0)+1});
    if(!coordinate)tx.set(lock,{calledAt:now.getTime()});
  });
  let candidates:Omit<VerifiedDestination,'id'>[];
  if(coordinate)candidates=[coordinate];
  else{
    const base=new URL(process.env.PBB_GEOCODER_BASE_URL||'https://photon.komoot.io');
    if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||/^\d+\./.test(base.hostname)||base.hostname==='localhost'||base.hostname.endsWith('.local'))throw new Error('Geocoder endpoint must be public HTTPS');
    const url=new URL(`${base.href.replace(/\/$/,'')}/api`);url.searchParams.set('q',query);url.searchParams.set('limit','5');url.searchParams.set('lang','en');
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(12_000),redirect:'error',headers:{'User-Agent':'PB&B location verification (https://tripplanner-910da.web.app/support)'}});
      if(!response.ok)throw new Error('Provider unavailable');
      const text=await response.text();if(text.length>200_000)throw new Error('Oversized location response');
      candidates=photonDestinations(JSON.parse(text));
    } catch {
      throw new HttpsError('unavailable','Location lookup is unavailable. Please try again later. No AI action was used.');
    }
  }
  const expiresAt=new Date(now.getTime()+7*86_400_000).toISOString();
  const results=candidates.map(place=>({...place,id:digest(`${key}|${place.label}|${place.latitude}|${place.longitude}`)}));
  const batch=db.batch();
  batch.set(ref,{uid,results,expiresAt});
  for(const result of results)batch.set(db.collection('verifiedDestinations').doc(result.id),{uid,...result,expiresAt});
  await batch.commit();
  return {results,attribution:'© OpenStreetMap contributors · Photon'};
}
export async function confirmedDestination(uid:string,id:unknown,label:string):Promise<VerifiedDestination>{
  if(typeof id!=='string'||! /^[a-f0-9]{32}$/.test(id))throw new HttpsError('failed-precondition','Look up and confirm your destination before searching along the way.');
  const record=(await getFirestore().collection('verifiedDestinations').doc(id).get()).data();
  return destinationFromRecord(record,uid,id,label);
}
export function destinationFromRecord(record:Record<string,any>|undefined,uid:string,id:string,label:string,now=Date.now()):VerifiedDestination{
  if(!record||record.uid!==uid||!Number.isFinite(Date.parse(record.expiresAt))||Date.parse(record.expiresAt)<=now||record.label!==label.trim()||!Number.isFinite(record.latitude)||!Number.isFinite(record.longitude))throw new HttpsError('failed-precondition','Your destination changed or its verification expired. Look it up and confirm it again.');
  return {id,label:record.label,latitude:record.latitude,longitude:record.longitude,country:record.country,region:record.region,kind:record.kind};
}
