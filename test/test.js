import test from 'ava';
import PouchDB from 'pouchdb-memory';

import uuid from 'uuid';

import PouchMigrate from 'pouchdb-migrate';
PouchDB.plugin(PouchMigrate);

import Model from '../src/index';
import init from '../src/init';

test('Create correct subtitles model', async t => {
  const db = new PouchDB('test', { adapter: 'memory' });
  const model = new Model(db, { createId: ({ name }) => name });

  const items0 = await model.findAll();
  t.truthy(items0.length === 0);

  let item = { name: 'test' };
  item = await model.update(item);
  t.deepEqual(Object.keys(item), ['name', '_id', 'updatedAt', '_rev']);

  item = await model.update(item);
  t.truthy(item._rev.indexOf('2-') === 0);

  const items1 = await model.findAll();
  t.truthy(items1.length === 1);
});

test('#sync', async t => {
  const db0 = new PouchDB('sync-0', { adapter: 'memory' });
  const db1 = new PouchDB('sync-1', { adapter: 'memory' });

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

test('#sync fail', async t => {
  const db = new PouchDB('sync-fail', { adapter: 'memory' });
  const model = new Model(db, { createId: ({ name }) => name });

  t.throws(model.sync('http://localhost:1024/', () => {})); // wrong address
});

test('#onNotFound', async t => {
  const model = new Model(null, { createId: () => `item:${uuid.v4()}` });
  t.throws(() => model.onNotFound(new Error('test')));
});

test('#createId', async t => {
  const model = new Model(null, { createId: () => `item:${uuid.v4()}` });

  const id0 = model.createId({ name: 'test' });
  const id1 = model.createId({ name: 'test' });

  t.truthy(id0 !== id1);

  t.truthy(model.createId({ _id: id0 }) === id0);
  t.truthy(model.createId({ _id: id0 }) === id0);
});

test('#normalizeAllDocsOptions', async t => {
  const model = new Model(null, { createId: () => `item:${uuid.v4()}` });

  t.deepEqual(model.normalizeAllDocsOptions({}), {
    skip: 0,
    startkey: '_design\uffff',
    endkey: undefined
  });

  t.deepEqual(model.normalizeAllDocsOptions({ descending: true }), {
    skip: 0,
    startkey: undefined,
    endkey: '_design',
    descending: true
  });

  t.deepEqual(model.normalizeAllDocsOptions({ startkey: 'random' }), {
    skip: 0,
    startkey: 'random',
    endkey: undefined
  });
});

test('#findOneOrInit', async t => {
  const db = new PouchDB('findOneOrInit', { adapter: 'memory' });
  const model = new Model(db, {
    createId: () => `item:${uuid.v4()}`
  });

  t.truthy((await model.findAll()).length === 0);
  const doc = await model.findOneOrInit({ name: 'test' }, () => model.put({ name: 'test', isFresh: true }));
  t.truthy((await model.findAll()).length === 1);
});

test('#put', async t => {
  const db = new PouchDB('put', { adapter: 'memory' });
  const model = new Model(db, {
    createId: () => `item:${uuid.v4()}`
  });

  await model.put({ name: 'test' });
});

test('#put with _key', async t => {
  const db = new PouchDB('put-key', { adapter: 'memory' });
  const model = new Model(db, {
    createId: () => `item:${uuid.v4()}`
  });

  const doc0 = await model.put({ name: 'test' });

  const doc1 = (await model.findAll())[0];
  doc1.balance = 5;

  const doc2 = await model.put(doc1);
  t.truthy(doc2.balance === 5);
});

test('#update', async t => {
  const db = new PouchDB('update', { adapter: 'memory' });
  const model = new Model(db, {
    createId: () => `item:${uuid.v4()}`
  });

  await model.update({ name: 'test' });
});

test('#ensureIndexes', async t => {
  const db = new PouchDB('ensureIndexes', { adapter: 'memory' });

  const index = 'test';
  const model = new Model(db, {
    createId: ({ name }) => name,
    indexes: [
      {
        name: index,
        fn: function(doc) {
          if (doc.numId) {
            emit(doc.numId);
          }
        }
      }
    ]
  });

  const doc = await model.put({ name: 'test', numId: '1' });
  await model.ensureIndexes();

  const res = await model.findByIndex(index, { key: '1' });
  t.deepEqual(res, [
    { ...doc, _key: '1' }
  ]);

  const pouchDocs = await db.allDocs();
  const modelDocs = await model.findAllRaw({ include_docs: false });

  t.truthy(pouchDocs.total_rows === 2);
  t.truthy(modelDocs.total_rows === 2);

  // pouchdb-model adjust startkey/endkey in order to filter design docs
  t.truthy(pouchDocs.rows.length === 2);
  t.truthy(modelDocs.rows.length === 1);

  t.truthy(pouchDocs.rows[0].id === '_design/test');

  // second time to cover skipping creating existing index
  await model.ensureIndexes();
});

test('#ensureIndexes missing', async t => {
  const db = new PouchDB('ensureIndexes-missing', { adapter: 'memory' });

  const model = new Model(db, {
    createId: ({ name }) => name,
  });

  await model.ensureIndexes();
});

test('#ensureMigrations', async t => {
  const db = new PouchDB('ensureMigrations', { adapter: 'memory' });

  const model = new Model(db, {
    createId: ({ name }) => name,
    migrations: [
      function(doc) {
        if ('foo' in doc) {
          return;
        }

        doc.foo = 'bar';
        return [doc];
      }
    ]
  });

  await model.put({ name: 'test' });

  const doc0 = await model.findById('test');
  t.falsy(doc0.foo);

  await model.ensureMigrations();

  const doc1 = await model.findById('test');
  t.truthy(doc1.foo);
});

test('#ensureMigrations missing', async t => {
  const db = new PouchDB('ensureMigrations-missing', { adapter: 'memory' });

  const model = new Model(db, {
    createId: ({ name }) => name,
  });

  await model.ensureMigrations();
});

test('pouchdb-model/dist/init', async t => {
  const Item = {
    createId: ({ name }) => name,
    indexes: [
      {
        name: 'test',
        fn: function(doc) {
          if (doc.numId) {
            emit(doc.numId);
          }
        }
      }
    ],
    migrations: [
      function(doc) {
        if ('foo' in doc) {
          return;
        }

        doc.foo = 'bar';
        return [doc];
      }
    ]
  };

  const createDb = name => new PouchDB('dist-init', { adapter: 'memory' });
  const validate = schema => data => Promise.resolve(data);

  const db = await init({ Item }, createDb, validate);

  t.deepEqual(Object.keys(db), ['Item']);
  t.truthy(db.Item instanceof Model);
});
