import test from 'node:test';import assert from 'node:assert/strict';import {amounts,parameters} from '../sizing.js';
test('20 percent budget shared by 4 margin-weighted orders',()=>{const m=amounts(750);assert.equal(m.budget,150);assert.ok(Math.abs(m.so/m.entry-1.1)<1e-12);assert.ok(Math.abs(Array.from({length:4},(_,j)=>m.entry*1.1**j).reduce((a,b)=>a+b)-150)<1e-10);});
test('reject invalid equity',()=>{for(const e of [0,-1,NaN,Infinity])assert.throws(()=>amounts(e));});
test('leverage floor, TP half step, SL 4 steps',()=>{const p=parameters({step:1,close:96},{lever:'100'});assert.equal(p.leverage,8);assert.equal(p.tpPct,p.stepPct*.5);assert.equal(p.slPct,p.stepPct*4);});
test('reject above raw cap before flooring',()=>{assert.equal(parameters({step:1,close:301},{lever:100}),null);assert.equal(parameters({step:1,close:200},{lever:19}),null);});
test('allow 1x, never promote raw below one',()=>{assert.equal(parameters({step:1,close:19},{lever:100}).leverage,1);assert.equal(parameters({step:1,close:9},{lever:100}),null);});
