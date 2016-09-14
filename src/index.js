module.exports = Model;

const log = console.log.bind(console);

function Model(db, { createId, indexes, migrations }, validate) {
  this._createId = createId;
  this.db = db;
  this.indexes = indexes;
  this.validate = validate;
  this.migrations = migrations;
}

Model.prototype.createId = function(data) {
  if (typeof data === 'object' && data._id) {
    return data._id;
  } else {
    return this._createId(data);
  }
};

Model.prototype.onNotFound = function(err, fn) {
  if (err.status === 404) {
    return fn();
  } else {
    throw err;
  }
};

Model.prototype.findById = function(id) {
  return this.db.get(id);
};

Model.prototype.findOne = function(id) {
  return this.db.get(this.createId(id));
};

Model.prototype.findOneOrInit = function(id, init) {
  return this
    .findOne(id)
    .then(null, err => this.onNotFound(err, init));
};

Model.prototype.findByIndexRaw = function(index, options = {}) {
  return this.db
    .query(index, normalizeAllDocsOptions({ include_docs: true, ...options }));
};

Model.prototype.findByIndex = function(index, options = {}) {
  return this
    .findByIndexRaw(index, options)
    .then(
      res => res.rows.map(
        row => ({
          ...row.doc,
          _key: row.key
        })
      )
    );
};

Model.prototype.findAllRaw = function(options = {}) {
  return this.db
    .allDocs(normalizeAllDocsOptions({ include_docs: true, ...options }));
};

Model.prototype.findAll = function(options = {}) {
  return this.findAllRaw(options)
    .then(res => res.rows.map(row => ({
      ...row.doc,
      _key: row.key
    })));
};

function normalizeAllDocsOptions(options) {
  const startkey = typeof options.startkey === 'undefined' ? (
    options.descending ? (
      options.since || undefined
    ) : (
      options.since || '_design\uffff'
    )
  ) : (
    options.startkey
  );

  const endkey = typeof options.endkey === 'undefined' ? (
    options.descending ? (
      '_design'
    ) : (
      options.since || undefined
    )
  ) : (
    options.endkey
  );

  const skip = options.since ? 1 : 0;

  delete options.since;
  delete options.startkey;
  delete options.endkey;

  return {
    skip,
    startkey,
    endkey,
    ...options
  };
}

Model.prototype.put = function(id, _data) {
  const data = _data || id;

  if ('_key' in data) {
    delete data._key;
  }

  const doc = {
    ...data,
    _id: this.createId(id),
    updatedAt: new Date().toISOString()
  };

  return this
    .validate(doc)
    .then(doc => this.db.put(doc))
    .then(() => doc);
};

Model.prototype.update = function(id, _data) {
  const data = _data || id;
  data.updatedAt = new Date().toISOString();

  return this
    .findOne(id)
    .then(
      dbData => {
        const obj = { ...dbData, ...data };
        obj._rev = dbData._rev;

        return this
          .validate(obj)
          .then(obj => this.put(id, obj));
      },
      err => this.onNotFound(err, () => {
        return this
          .validate(data)
          .then(obj => this.put(id, obj));
      })
    );
};

Model.prototype.createDesignDoc = function(name, mapFunction) {
  const ddoc = {
    _id: '_design/' + name,
    views: {}
  };

  ddoc.views[name] = { map: mapFunction.toString() };
  return ddoc;
};

Model.prototype.ensureIndexes = function() {
  if (!this.indexes) {
    return Promise.resolve();
  }

  const promises = this.indexes
    .map(({ name, fn }) => {
      const designDoc = this.createDesignDoc(name, fn);

      return this.db
        .put(designDoc)
        .then(() => {
          log(`${designDoc._id} has been created`);
        }, err => {
          if (err.name === 'conflict') {
            log(`${designDoc._id} already exists`);
          } else {
            throw err;
          }
        });
    });

  return Promise.all(promises);
};

Model.prototype.ensureMigrations = function() {
  if (!this.db.migrate) {
    return Promise.reject(`pouchdb-migrate is missing - PouchDB.plugin(require('pouchdb-migrate'))`);
  }

  const result = Promise.resolve();

  if (!this.migrations) {
    return result;
  }

  return this.migrations.reduce((prev, migration, index) => {
    return prev.then(() => {
      log(`start migration ${index + 1} / ${this.migrations.length}`);

      return this.db
        .migrate(migration)
        .then(() => {
          log(`finish ${index + 1} / ${this.migrations.length}`);
        });
    });
  }, result);
};
