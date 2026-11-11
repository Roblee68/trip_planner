import assert from 'node:assert/strict';
import test from 'node:test';
import { cityId,clockInZone,normalizeEvent,selectStoredEvents,storedScoutResponse } from '../lib/eventRecords.js';
import { jsonArrayRows,torontoEvent } from '../lib/torontoEvents.js';
import { allowance,assertPaidAllowance } from '../lib/paidBudget.js';

const now=new Date('2026-11-11T15:00:00Z');
const raw={title:'Pottery workshop',summary:'Learn to make a mug.',category:'arts',eventDate:'2026-11-11',eventTime:'11:00',startsAt:'2026-11-11T11:00:00-05:00',endsAt:'2026-11-11T13:00:00-05:00',priceAmount:15,currency:'CAD',sourceUrl:'https://venue.example/pottery',sourceEventId:'pottery',venue:'Art school',address:'123 Main Street'};
const make=(overrides={})=>normalizeEvent({...raw,...overrides},'Toronto, Canada','America/Toronto',now,'test-feed');
const request={place:'Toronto, Canada',prompt:'Find something',currency:'CAD',maxBudget:30,maxDistanceKm:25,interests:['Arts'],topics:[],travelModes:[],refinement:'balanced',occasion:'discover'};

test('city identity shares capitalization, whitespace and punctuation variants',()=>{
  assert.equal(cityId('TORONTO,  Canada'),cityId('Toronto Canada'));
  assert.notEqual(cityId('London, Canada'),cityId('London, United Kingdom'));
});
test('stores source timezone and UTC instants without substituting device timezone',()=>{
  const event=make();assert.equal(event.timeZone,'America/Toronto');assert.equal(event.startsAt,'2026-11-11T16:00:00.000Z');
  assert.deepEqual(clockInZone(new Date('2026-11-12T02:30:00Z'),'America/Los_Angeles'),{date:'2026-11-11',time:'18:30'});
});
test('rejects an invalid IANA zone, impossible dates and DST gap timestamps',()=>{
  assert.equal(normalizeEvent(raw,'Toronto, Canada','Fake/Zone',now,'test'),null);
  assert.equal(make({eventDate:'2026-02-30'}),null);
  assert.equal(normalizeEvent({...raw,eventDate:'2027-03-14',eventTime:'02:30',startsAt:'2027-03-14T02:30:00-05:00'},'Toronto, Canada','America/Toronto',new Date('2027-03-01T12:00:00Z'),'test'),null);
});
test('stable IDs deduplicate repeat imports and keep separate dated sessions',()=>{
  assert.equal(make().id,make({summary:'Updated description'}).id);
  assert.notEqual(make().id,make({eventDate:'2026-11-12',startsAt:'2026-11-12T11:00:00-05:00'}).id);
});
test('discovery shows distinct activities rather than five sessions of one series',()=>{
  const first=make(),next=make({eventDate:'2026-11-12',startsAt:'2026-11-12T11:00:00-05:00'});
  const other=make({title:'Gallery tour',sourceEventId:'gallery'});
  assert.deepEqual(selectStoredEvents([first,next,other],request,now).map(event=>event.title).sort(),['Gallery tour','Pottery workshop']);
});
test('date labels display the event timezone as a readable abbreviation',()=>{
  const label=storedScoutResponse([make()],request,now).ideas[0].dateText;
  assert.match(label,/Nov/);assert.match(label,/EST/);assert.doesNotMatch(label,/America\//);
});
test('unknown price and coordinates stay unknown; free price is explicit',()=>{
  const event=make({priceAmount:null});assert.equal(event.priceAmount,null);assert.equal(event.latitude,null);
  assert.equal(selectStoredEvents([event],{...request,prompt:'Something free'},now).length,0);
  assert.equal(storedScoutResponse([event],request,now).ideas[0].priceText,'Price not listed — check source');
});
test('excludes cancelled, ended, stale, future-checked and over-budget events',()=>{
  const event=make();
  for(const overrides of [{status:'cancelled'},{endsAt:'2026-11-11T14:00:00Z'},{checkedAt:'2026-11-01T12:00:00Z'},{checkedAt:'2026-11-12T12:00:00Z'},{priceAmount:100}]){
    assert.equal(selectStoredEvents([{...event,...overrides}],request,now).length,0);
  }
});
test('today uses event timezone and requires known closing time for limited outings',()=>{
  const event=make();const today={...request,occasion:'today',timeAvailableHours:3,localDate:'2026-11-12'};
  assert.equal(selectStoredEvents([event],today,now).length,1);
  assert.equal(selectStoredEvents([{...event,endsAt:null}],today,now).length,0);
});
test('only calculates radius when real coordinates exist, without inventing a distance',()=>{
  const event=make({latitude:45,longitude:-80});
  assert.equal(selectStoredEvents([event],{...request,latitude:43.65,longitude:-79.38,maxDistanceKm:5},now).length,0);
});
test('stream parser handles chunk boundaries, nested arrays, escapes and Unicode',async()=>{
  const rows=[{title:'A {test} \\" café',nested:[{id:1}]},{id:2}];
  const bytes=new TextEncoder().encode(JSON.stringify({value:rows}));
  async function* chunks(){for(let i=0;i<bytes.length;i+=3)yield bytes.slice(i,i+3);}
  const parsed=[];for await(const row of jsonArrayRows(chunks()))parsed.push(row);
  assert.deepEqual(parsed,rows);
});
test('truncated feeds fail instead of publishing a partial replacement',async()=>{
  async function* chunks(){yield new TextEncoder().encode('{"value":[{"id":1},');}
  await assert.rejects(async()=>{for await(const row of jsonArrayRows(chunks()))void row;},/Incomplete/);
});
test('Toronto imports dated sessions and explicit free admission with attribution',()=>{
  const row={id:'public-id',calendar_date:'2026-11-11T11:00:00-05:00',event_name:'Museum workshop',free_event:'Yes',event_status:'Approved',event_website:'https://museum.example/workshop',event_category:['Arts/Exhibits'],event_locations:[{location_address:'Toronto',location_dates:'[]'}]};
  const event=torontoEvent(row,now);assert.equal(event.priceAmount,0);assert.equal(event.timeZone,'America/Toronto');assert.match(event.attribution,/Open Government Licence/);
  assert.equal(torontoEvent({...row,event_name:'Classical ballet',event_category:['Dance']},now).category,'theatre');
  assert.equal(torontoEvent({...row,calendar_date:'2025-11-11T11:00:00-05:00'},now),null);
});
test('daily allowance applies inclusive user/global boundaries and UTC rollover',()=>{
  assert.doesNotThrow(()=>assertPaidAllowance(4,49));
  assert.throws(()=>assertPaidAllowance(5,0),/5 AI actions/);
  assert.throws(()=>assertPaidAllowance(0,50),/shared limit/);
  assert.deepEqual(allowance(2,now),{limit:5,remaining:3,resetsAt:'2026-11-12T00:00:00.000Z'});
});
