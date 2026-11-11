import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const PAID_USER_DAILY_LIMIT = 5;
export const PAID_GLOBAL_DAILY_LIMIT = 50;
export const CITY_AI_DAILY_LIMIT = 10;
export function allowance(count:number,now=new Date()){
  const reset=new Date(now);reset.setUTCHours(24,0,0,0);
  return {limit:PAID_USER_DAILY_LIMIT,remaining:Math.max(0,PAID_USER_DAILY_LIMIT-count),resetsAt:reset.toISOString()};
}
export function assertPaidAllowance(count:number,globalCount:number){
  if(count>=PAID_USER_DAILY_LIMIT)throw new HttpsError('resource-exhausted','You’ve used today’s 5 AI actions. They reset at midnight UTC. You can still browse and filter collected events.');
  if(globalCount>=PAID_GLOBAL_DAILY_LIMIT)throw new HttpsError('resource-exhausted','Live AI has reached today’s shared limit. You can still browse and filter collected events.');
}
export async function readAllowance(uid:string,now=new Date()){
  const day=now.toISOString().slice(0,10),usage=getFirestore().collection('agentUsage');
  const [user,global]=await getFirestore().getAll(usage.doc(`${uid}_${day}`),usage.doc(`global_${day}`));
  return {...allowance(Number(user.data()?.count??0),now),available:Number(global.data()?.count??0)<PAID_GLOBAL_DAILY_LIMIT};
}
export async function reservePaidAction(uid?:string,now=new Date()):Promise<void>{
  const day=now.toISOString().slice(0,10),usage=getFirestore().collection('agentUsage');
  const global=usage.doc(`global_${day}`),user=uid?usage.doc(`${uid}_${day}`):null;
  await getFirestore().runTransaction(async tx=>{
    const globalData=await tx.get(global),userData=user?await tx.get(user):null;
    const count=Number(userData?.data()?.count??0),globalCount=Number(globalData.data()?.count??0);
    assertPaidAllowance(count,globalCount);
    if(user)tx.set(user,{count:count+1,updatedAt:now.toISOString()},{merge:true});
    tx.set(global,{count:globalCount+1,updatedAt:now.toISOString()},{merge:true});
  });
}
