import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { ScoutRequest, ScoutResponse } from './contracts.js';

/** Route responses stay private to the caller; no private routes enter the public city catalogue. */
export async function cachedRouteScout(uid:string,input:ScoutRequest,produce:()=>Promise<ScoutResponse>,now=new Date()):Promise<ScoutResponse>{
  const key=createHash('sha256').update(JSON.stringify([uid,{...input,localTime:input.localTime?.slice(0,2)}])).digest('hex');
  const ref=getFirestore().collection('routeScoutCache').doc(key);
  const claim=await getFirestore().runTransaction(async tx=>{
    const data=(await tx.get(ref)).data();
    if(data?.response&&Date.parse(data.expiresAt)>now.getTime())return data.response as ScoutResponse;
    if(Date.parse(data?.refreshingUntil)>now.getTime())throw new HttpsError('resource-exhausted','This route search is already running. Please wait before trying again.');
    tx.set(ref,{uid,refreshingUntil:new Date(now.getTime()+3*60_000).toISOString(),deleteAfter:new Date(now.getTime()+86_400_000)},{merge:true});
    return null;
  });
  if(claim)return claim;
  try{
    const response=await produce();
    await ref.set({uid,response,expiresAt:new Date(now.getTime()+30*60_000).toISOString(),refreshingUntil:FieldValue.delete(),deleteAfter:new Date(now.getTime()+86_400_000)},{merge:true});
    return response;
  }catch(error){await ref.set({refreshingUntil:FieldValue.delete()},{merge:true});throw error;}
}
