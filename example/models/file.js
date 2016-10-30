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
