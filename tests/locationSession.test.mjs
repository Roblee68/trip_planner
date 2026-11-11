import assert from 'node:assert/strict';
import test from 'node:test';
import {locationFixFor,setLocationFix} from '../src/locationSession.ts';
test('a location fix is only used for the matching selected place',()=>{
 setLocationFix({latitude:43.65,longitude:-79.38,place:'Toronto, Canada',checkedAt:1000});
 assert.deepEqual(locationFixFor('TORONTO, CANADA',2000),{latitude:43.65,longitude:-79.38});
 assert.equal(locationFixFor('New York, United States',2000),null);
});
test('stale and revoked location fixes are not sent to searches',()=>{
 setLocationFix({latitude:43.65,longitude:-79.38,place:'Toronto, Canada',checkedAt:1000});
 assert.equal(locationFixFor('Toronto, Canada',1000+16*60000),null);
 setLocationFix(null);assert.equal(locationFixFor('Toronto, Canada',2000),null);
});
test('outbound GPS coordinates omit the precise fix',()=>{
 setLocationFix({latitude:43.65123456,longitude:-79.38123456,place:'Toronto, Canada',checkedAt:1000});
 assert.deepEqual(locationFixFor('Toronto, Canada',2000),{latitude:43.651,longitude:-79.381});
});
