import PouchDB from 'pouchdb';
import init from 'pouchdb-model/dist/init';

// if you don't use migrations, you could omit this import
import MigratePlugin from 'pouchdb-migrate';
PouchDB.plugin(MigratePlugin);

const File = {
  createId: ({ name }) => name,
  migrations: [
    function(doc) {
      if (doc.foo) {
        return;
      }

      doc.foo = true;
      return [doc];
    }
  ],
  indexes: [
    {
      name: 'updatedAtIndex',
      fn: function(doc) {
        emit(doc.updatedAt + '$' + doc._id);
      }
    }
  ]
};

async function main(models) {
  const { File } = await init(models, name => new PouchDB(name.toLowerCase()))

  const docA = await File.put({ name: 'user-a' });
  /*
  { name: 'user-a',
    _id: 'user-a',
    updatedAt: '2016-11-03T19:35:19.869Z',
    _rev: '1-1ccfb26dd920cbf8ac11c965efac73d9' }
  */
  const docB = await File.put({ name: 'user-b' });
  /*
  { name: 'user-b',
    _id: 'user-b',
    updatedAt: '2016-11-03T19:36:16.827Z',
    _rev: '1-7ce9e72b2c2ed18fd1753e0c6627e6b0' }
  */

  const docs = await File.findAll();
  /*
  [ { name: 'user-a',
    updatedAt: '2016-11-03T19:38:44.765Z',
    _id: 'user-a',
    _rev: '1-722dd9fc99ef1f04334544bc01e0639a',
    _key: 'user-a' },
  { name: 'user-b',
    updatedAt: '2016-11-03T19:38:44.766Z',
    _id: 'user-b',
    _rev: '1-b3b0f835f60044a68faf04e80a91ced7',
    _key: 'user-b' } ]
  */

  const lastDocs = await File.findAll({ since: 'user-a' });

  /*
  [ { name: 'user-b',
      updatedAt: '2016-11-03T19:57:25.189Z',
      _id: 'user-b',
      _rev: '1-2797788789747732e19138f1600bc91b',
      _key: 'user-b' } ]
  */

  const docsByUpdateAt = await File.findByIndex('updatedAtIndex', { descending: true });
  /*
  [ { name: 'user-b',
    updatedAt: '2016-11-03T19:45:27.729Z',
    _id: 'user-b',
    _rev: '1-ab63623e330d68e060bc2f93ddab0279',
    _key: '2016-11-03T19:39:27.403Z$user-b' },
  { name: 'user-a',
    updatedAt: '2016-11-03T19:45:27.728Z',
    _id: 'user-a',
    _rev: '1-c6da589a48e47402198e145ace61155f',
    _key: '2016-11-03T19:39:27.403Z$user-a' } ]
  */
}

try {
  main({ File });
} catch (e) {
  console.error(e.stack || e);
}
