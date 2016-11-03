import test from 'ava';
import PouchDB from 'pouchdb-memory';

import Model from '../src/index';

test('#ensureMigrations without plugin', async t => {
  const db = new PouchDB('ensureMigrations-no-plugin', { adapter: 'memory' });

  const model = new Model(db, {
    createId: ({ name }) => name,
  });

  t.throws(model.ensureMigrations());
});
