import init from './models';

init()
  .then(db => {
    console.log('app started');
  })
  .catch(err => console.log(err.stack || err));
