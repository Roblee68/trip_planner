import assert from 'node:assert/strict';
import test from 'node:test';
import {coordinateDestination,destinationQuery,photonDestinations,destinationFromRecord} from '../lib/destinations.js';
import {parseScoutRequest} from '../lib/selection.js';

const feature=(properties,coordinates=[-74.006,40.713])=>({type:'Feature',geometry:{type:'Point',coordinates},properties:{osm_id:123,osm_type:'R',country:'United States',...properties}});
test('verification supports cities, full addresses and landmarks with regional labels',()=>{
 const results=photonDestinations({features:[feature({name:'New York',city:'New York',state:'New York',osm_value:'city'}),feature({name:'A museum',housenumber:'25',street:'Main Street',city:'Boston',state:'Massachusetts',osm_value:'museum'})]});
 assert.equal(results[0].label,'New York, New York, United States');
 assert.match(results[1].label,/25 Main Street, Boston, Massachusetts, United States/);
 assert.equal(results[0].latitude,40.713);assert.equal(results[0].longitude,-74.006);
});
test('no provider match stays empty instead of inventing a destination',()=>{
 assert.deepEqual(photonDestinations({features:[]}),[]);
 assert.deepEqual(photonDestinations({features:[feature({name:'Invalid'},[181,91])]}),[]);
 assert.throws(()=>destinationQuery('<script>made up</script>'));
});
test('coordinate destinations are bounded and require no external lookup',()=>{
 assert.equal(coordinateDestination('43.65, -79.38').label,'43.65000, -79.38000');
 assert.throws(()=>coordinateDestination('91, -79'));
 assert.equal(coordinateDestination('New York City'),null);
});
test('confirmation is tied to the account, exact selected label and expiry',()=>{
 const now=Date.parse('2026-11-11T18:00:00Z');
 const record={uid:'test-user',label:'New York, United States',latitude:40.713,longitude:-74.006,expiresAt:'2026-11-12T00:00:00Z',kind:'city',region:'New York',country:'United States'};
 assert.equal(destinationFromRecord(record,'test-user','id',record.label,now).latitude,40.713);
 assert.throws(()=>destinationFromRecord(record,'another-user','id',record.label,now));
 assert.throws(()=>destinationFromRecord(record,'test-user','id','Dr. Seuss land',now));
 assert.throws(()=>destinationFromRecord({...record,expiresAt:'invalid'},'test-user','id',record.label,now));
 assert.throws(()=>destinationFromRecord(record,'test-user','id',record.label,now+86400000));
});
test('discovery preserves valid device timezone and paired consented coordinates',()=>{
 const base={prompt:'Find events',place:'Toronto, Canada',currency:'CAD',maxBudget:100,maxDistanceKm:25,timeZone:'America/Toronto',latitude:43.65,longitude:-79.38};
 const request=parseScoutRequest(base);assert.equal(request.timeZone,'America/Toronto');assert.equal(request.latitude,43.65);
 assert.throws(()=>parseScoutRequest({...base,timeZone:'Dr/Seuss'}));
 assert.throws(()=>parseScoutRequest({...base,longitude:undefined}));
});
