const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const ora = require('ora');
const R = require('ramda');
const WebPageTest = require('webpagetest');
const wptApiKey = require('./webpagetestApiKey.json');
const serviceAccount = require('./serviceAccountKey.json');

const error = chalk.bold.red;

if (!wptApiKey) {
  console.log(error('Webpage Test API Key not supplied.'));
  process.exit(1);
}

const { website } = argv;

if (!website) {
  console.log(error('URL not provided. Use --website "https://google.com" when running this script.'));
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://donovan-performance-dashboard.firebaseio.com',
});

const db = admin.firestore();
const wpt = new WebPageTest('www.webpagetest.org', wptApiKey);

const getScores = R.pipe(
  R.pathOr({}, ['average', 'firstView']),
  R.pick([
    'score_cdn',
    'score_gzip',
    'score_cache',
    'score_compress',
    'score_progressive_jpeg',
  ]),
);

const runTest = url => new Promise((resolve, reject) => {
  if (argv.wptresult) {
    return resolve(argv.wptresult);
  }
  return wpt.runTest(url, { pollResults: 10, timeout: 600 }, (err, data) => {
    if (err) {
      return reject(err);
    }
    return resolve(data.data.id);
  });
});

const getResults = testId => new Promise((resolve, reject) => {
  wpt.getTestResults(testId, (err, response) => {
    if (err) {
      reject(err);
    }
    resolve(response.data);
  });
});

const writeToFirestore = scores => db.collection('perf-scores').doc().set(scores);

const createRecord = data => ({
  timestamp: admin.firestore.Timestamp.now(),
  scores: getScores(data),
});

const spinner = ora('Running Web Page Test').start();

runTest(website)
  .then((id) => {
    spinner.succeed();
    return getResults(id);
  })
  .then((data) => {
    const record = createRecord(data);
    const dbSpinner = ora('Writing to db').start();
    return writeToFirestore(record)
      .then(() => {
        dbSpinner.succeed();
      });
  });
