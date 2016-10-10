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

  let item = { name: 'test' };
  item = await model.update(item);
  t.deepEqual(Object.keys(item), ['name', 'updatedAt', '_id', '_rev']);

  item = await model.update(item);
  t.truthy(item._rev.indexOf('2-') === 0);

  const items1 = await model.findAll();
  t.truthy(items1.length === 1);
});
