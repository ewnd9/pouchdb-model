import Model from './';

const noopValidation = () => input => Promise.resolve(input);

export default (initializers, createDb, validateFactory = noopValidation) => {
  const models = Object
    .keys(initializers)
    .reduce((result, key) => {
      const db = createDb(key);
      const model = initializers[key];
      const validate = validateFactory(model.schema);

      result[key] = new Model(db, model, validate);
      return result;
    }, {});

  const promises = Object
    .keys(models)
    .map(key => {
      return Promise.resolve()
        .then(() => models[key].ensureMigrations())
        .then(() => models[key].ensureIndexes());
    });

  return Promise.all(promises).then(() => models);
};
