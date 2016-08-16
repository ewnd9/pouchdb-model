import test from 'ava';
import 'babel-core/register';

import PouchDB from 'pouchdb';
import 'pouchdb/extras/memory';

import Model from '../src/index';

test('Create correct subtitles model', async t => {
  const db = new PouchDB('test', { adapter: 'memory' });
  const model = new Model(db, { createId: ({ name }) => name });

  const items = await model.findAll();
  t.truthy(items.rows.length === 0);
});
