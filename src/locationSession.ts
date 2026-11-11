/** Precise GPS fixes stay in memory, never in the saved preference file. */
type LocationFix={latitude:number;longitude:number;place:string;checkedAt:number};
let current:LocationFix|null=null;
export function setLocationFix(value:LocationFix|null):void{current=value;}
export function locationFixFor(place:string,now=Date.now()):{latitude:number;longitude:number}|null{
  if(!current||current.place.trim().toLowerCase()!==place.trim().toLowerCase()||now-current.checkedAt>15*60_000||current.checkedAt>now||!Number.isFinite(current.latitude)||!Number.isFinite(current.longitude)||Math.abs(current.latitude)>90||Math.abs(current.longitude)>180)return null;
  // About 100 m precision is sufficient for nearby events and route research.
  return {latitude:Number(current.latitude.toFixed(3)),longitude:Number(current.longitude.toFixed(3))};
}
