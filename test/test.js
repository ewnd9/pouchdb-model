import test from 'ava';
import PouchDB from 'pouchdb-memory';

import Model from '../src/index';
import init from '../src/init';

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

test('sync', async t => {
  const db0 = new PouchDB('test0', { adapter: 'memory' });
  const db1 = new PouchDB('test1', { adapter: 'memory' });

  const model0 = new Model(db0, { createId: ({ name }) => name });
  const model1 = new Model(db1, { createId: ({ name }) => name });

  await model0.put({ name: 'test0' });
  await model1.put({ name: 'test1' });

  const messages = [];
  await model0.sync(db1, (type, info, message) => {
    messages.push(message);
  });

  t.deepEqual(messages, [
    'Action',
    'Pull: 1 read, 1 written',
    'Push: 1 read, 1 written',
    'Paused',
    'Complete'
  ]);
});
