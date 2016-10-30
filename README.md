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

// `pouchdb-model` is completely decoupled from `tcomb`, you could use any validation library
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

import File from './file';
import initPouchModels from 'pouchdb-model/dist/init';

// if you don't use migrations, you could omit this import
import MigratePlugin from 'pouchdb-migrate';
PouchDB.plugin(MigratePlugin);

const initializers = {
  File
};

export default () => {
  return initPouchModels(initializers, createDb, validationFactory)
    .then(db => { //=> { File } // instances of `pouchdb-model`
      return db;
    });
}

function createDb(name) {
  const db = new PouchDB(name.toLowerCase());
  db.on('error', err => console.log('pouch-error', err));

  return db;
}

function validationFactory(schema) {
  return obj => {
    const result = t.validate(obj, schema, { strict: true });
    return result.isValid() ? Promise.resolve(obj) : Promise.reject(result.errors);
  };
}
```

## License

MIT © [ewnd9](http://ewnd9.com)
