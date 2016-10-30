import PouchDB from 'pouchdb';
import t from 'tcomb-validation';

import File from './file';
import initPouchModels from 'pouchdb-model/dist/init';

// if you don't use migrations, you could omit this import
import MigratePlugin from 'pouchdb-migrate';
PouchDB.plugin(MigratePlugin);

const initializers = {
  File
};

export default () => initPouchModels(initializers, createDb, validateFactory);

function createDb(name) {
  const db = new PouchDB(name.toLowerCase());
  db.on('error', err => console.log('pouch-error', err));
  
  return db;
}

function validateFactory(schema) {
  return obj => {
    const result = t.validate(obj, schema, { strict: true });
    return result.isValid() ? Promise.resolve(obj) : Promise.reject(result.errors);
  };
}
