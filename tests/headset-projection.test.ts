import assert from 'node:assert/strict';
import test from 'node:test';
import { headsetProjection } from '../lib/marketing/headsetProjection.ts';

test('a full yaw returns cups and microphone to their exact resting position', () => {
 const a=headsetProjection(0), b=headsetProjection(Math.PI*2);
 for (let i=0;i<2;i++) assert.ok(Math.abs(a.cups[i].x-b.cups[i].x)<1e-8);
 assert.ok(Math.abs(a.mic.x-b.mic.x)<1e-8);
 assert.equal(a.mic.front,true);
 assert.equal(headsetProjection(Math.PI).mic.front,false);
});
test('cups exchange front and back as the solid head turns',()=>{
 const a=headsetProjection(Math.PI/2),b=headsetProjection(Math.PI*1.5);
 assert.equal(a.cups[0].front,true);
 assert.equal(a.cups[1].front,false);
 assert.equal(b.cups[0].front,false);
 assert.equal(b.cups[1].front,true);
 for(let i=0;i<80;i++){
  const p=headsetProjection(i/80*Math.PI*2);
  assert.ok(!JSON.stringify(p).includes('NaN'));
  assert.ok(p.cups.every(c=>c.scaleX>0));
 }
});
