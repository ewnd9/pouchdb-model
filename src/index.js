module.exports = Model;

const log = require('debug')('pouchdb-model');
const capitalize = require('lodash.capitalize');
const noopValidation = input => Promise.resolve(input);

function Model(db, { createId, indexes, migrations }, validate) {
  this._createId = createId;
  this.db = db;
  this.indexes = indexes;
  this.validate = validate || noopValidation;
  this.migrations = migrations;
}

Model.prototype.createId = function(data) {
  if (data._id) {
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
    .query(index, this.normalizeAllDocsOptions({ include_docs: true, ...options }));
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
    .allDocs(this.normalizeAllDocsOptions({ include_docs: true, ...options }));
};

Model.prototype.findAll = function(options = {}) {
  return this.findAllRaw(options)
    .then(res => res.rows.map(row => ({
      ...row.doc,
      _key: row.key
    })));
};

Model.prototype.normalizeAllDocsOptions = function(options) {
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
};

Model.prototype.put = function(data) {
  if ('_key' in data) {
    delete data._key;
  }

  const doc = {
    ...data,
    _id: this.createId(data),
    updatedAt: new Date().toISOString()
  };

  return this
    .validate(doc)
    .then(doc => this.db.put(doc))
    .then(result => { // Object.keys(result) //=> ['ok', 'id', 'rev']
      doc._rev = result.rev;
      return doc;
    });
};

Model.prototype.update = function(data) {
  data._id = this.createId(data);
  data.updatedAt = new Date().toISOString();

  return this
    .findOne(data)
    .then(
      dbData => {
        const obj = { ...dbData, ...data };
        obj._rev = dbData._rev;
        return this.put(obj);
      },
      err => this.onNotFound(err, () => {
        return this.put(data);
      })
    );
};

Model.prototype.bulk = function(docs) {
  const errors = [];
  const correct = [];

  return Promise
    .all(
      docs.map((doc, index) => this.validate(doc).then(
        doc => correct.push({ doc, index }),
        err => errors.push({
          err: {
            error: true,
            name: 'validation error',
            err
          },
          index
        })
      ))
    )
    .then(() => {
      const docs = correct.map(item => {
        item.doc._id = this.createId(item.doc);
        return item.doc;
      });
      return this.db.bulkDocs(docs);
    })
    .then(dbDocs => {
      let correctIndex = 0;
      let errorsIndex = 0;
      let dbIndex = 0;

      return docs.map((doc, index) => {
        let dbDoc;

        if (correct[correctIndex] && correct[correctIndex].index === index) {
          dbDoc = dbDocs[dbIndex];
          correctIndex++;
          dbIndex++;
        } else if (errors[errorsIndex] && errors[errorsIndex].index === index) {
          dbDoc = errors[errorsIndex].err;
          errorsIndex++;
        }

        if (dbDoc.ok === true) {
          return {
            ...docs[index],
            _id: dbDoc.id,
            _rev: dbDoc.rev
          };
        }

        return dbDoc;
      });
    });
};

/*
 * https://pouchdb.com/api.html#sync
 */
Model.prototype.sync = function(db, options, notify) {
  if (!notify && typeof options === 'function') {
    notify = options;
    options = {};
  }

  return new Promise((resolve, reject) => {
    this.db
      .sync(db, options)
      .on('change', info => {
        // handle change // info.doc_read info.doc_written info.last_seq info.errors
        const message =
          `${capitalize(info.direction)}: ` +
          `${info.change.docs_read} read, ${info.change.docs_written} written`;

        notify('change', info, message);
      })
      .on('paused', err => {
        // replication paused (e.g. replication up to date, user went offline)
        notify('paused', err, 'Paused');
      })
      .on('active', () => {
        // replicate resumed (e.g. new changes replicating, user went back online)
        notify('action', null, 'Action');
      })
      .on('denied', err => {
        // a document failed to replicate, e.g. due to permissions
        notify('denied', err, 'Denied');
      })
      .on('complete', info => {
        // handle complete
        notify('complete', info, 'Complete');
        resolve();
      })
      .on('error', err => {
        notify('error', err, `Error: ${err.message}`);
        reject(err);
      });
  });
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
