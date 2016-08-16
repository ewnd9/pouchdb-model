# pouchdb-model

[![Build Status](https://travis-ci.org/ewnd9/pouchdb-model.svg?branch=master)](https://travis-ci.org/ewnd9/pouchdb-model)

Convenient wrapper for pouchdb

See [index.js](src/index.js) for the available methods (proper docs are coming)

## Install

```
$ npm install --save pouchdb-model
```

## Usage

```js
// file.js
import t from 'tcomb-validation';

export const updatedAtIndex = 'updatedAtIndex';

const File = {
  createId: ({ name }) => name,
  schema: t.struct({
    _id: t.maybe(t.String),
    _rev: t.maybe(t.String),
    _key: t.maybe(t.String),
    updatedAt: t.maybe(t.String),

    name: t.String
  }),
  migrations: [],
  indexes: [
    {
      name: updatedAtIndex,
      fn: `function(doc) {
        emit(doc.updatedAt + '$' + doc._id);
      }`
    }
  ]
};

export default File;
```

```js
// index.js
// inspired by sequelize

import PouchDB from 'pouchdb';
import t from 'tcomb-validation';
import Model from 'pouchdb-model';

import MigratePlugin from 'pouchdb-migrate';
PouchDB.plugin(MigratePlugin);

import File from './file';

export default (dbPath, dbOptions = {}) => {
  const initializers = {
    File
  };

  if (!('auto_compaction' in dbOptions)) {
    dbOptions.auto_compaction = true;
  }

  const models = Object
    .keys(initializers)
    .reduce((result, key) => {
      const name = key.toLowerCase();

      const db = new PouchDB(`${dbPath}-${name}`, dbOptions);
      db.on('error', err => console.log('pouch-error', err));

      const obj = initializers[key];
      const validate = validateFactory(obj.schema);

      result[key] = new Model(db, obj, validate);

      return result;
    }, {});

  const promises = Object
    .keys(models)
    .map(key => {
      return models[key].db.compact()
        .then(() => models[key].ensureMigrations())
        .then(() => models[key].ensureIndexes());
    });

  return Promise.all(promises).then(() => models);
};

function validateFactory(schema) {
  if (!schema) {
    return obj => Promise.resolve(obj);
  }

  return obj => {
    const result = t.validate(obj, schema, { strict: true });

    if (result.isValid()) {
      return Promise.resolve(obj);
    }

    return Promise.reject(result.errors);
  };
}

```

## License

MIT © [ewnd9](http://ewnd9.com)
