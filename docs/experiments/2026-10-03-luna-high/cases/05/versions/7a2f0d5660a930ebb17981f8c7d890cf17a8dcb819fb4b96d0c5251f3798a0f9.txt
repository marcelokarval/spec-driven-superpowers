import test from 'node:test';
import assert from 'node:assert/strict';
import {listOrders} from '../src/app.js';
test('preserves all orders and input order',()=>{const data=[{id:'B'},{id:'A'}];assert.deepEqual(listOrders(data),data);assert.notEqual(listOrders(data),data);});
