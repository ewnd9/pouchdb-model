import test from 'ava';
import 'babel-core/register';

import PouchDB from 'pouchdb';
import 'pouchdb/extras/memory';

import Model from '../src/index';

test('Create correct subtitles model', async t => {
  const db = new PouchDB('test', { adapter: 'memory' });
  const model = new Model(db, { createId: ({ name }) => name });

  const items0 = await model.findAll();
  t.truthy(items0.length === 0);

  const item = { name: 'test' };
  const itemDb = await model.update(item);
  t.deepEqual(Object.keys(itemDb), ['name', 'updatedAt', '_id']);

  const items1 = await model.findAll();
  t.truthy(items1.length === 1);
});
