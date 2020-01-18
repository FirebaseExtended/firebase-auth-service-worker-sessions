/*
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const app = express();
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const path = require('path');

/**
 * Renders the profile page and serves it in the response.
 * @param {string} endpoint The get profile endpoint.
 * @param {!Object} req The expressjs request.
 * @param {!Object} res The expressjs response.
 * @param {!firebase.auth.DecodedIdToken} decodedClaims The decoded claims from verified
 *     session cookies.
 * @return {!Promise} A promise that resolves on success.
 */
function serveContentForUser(endpoint, req, res, decodedClaims) {
  // Lookup the user information corresponding to cookie and return the profile
  // data for the user.
  return admin.auth().getUser(decodedClaims.sub).then((userRecord) => {
    const html = '<!DOCTYPE html>' +
      '<html>' +
      '<meta charset="UTF-8">' +
      '<link href="/styles/style.css" rel="stylesheet" type="text/css" ' +
      '      media="screen" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Sample Profile Page</title>' +
      '<body>' +
      '<div id="container">' +
      '  <h3>Welcome to Session Management with Service Workers Demo, ' +
      (userRecord.displayName || 'N/A') + '</h3>' +
      '  <div id="loaded">' +
      '    <div id="main">' +
      '      <div id="user-signed-in">' +
      // Show user profile information.
      '        <div id="user-info">' +
      '          <div id="photo-container">' +
      (userRecord.photoURL ? '      <img id="photo" src=' +
          userRecord.photoURL + '>' : '') +
      '          </div>' +
      '          <div id="name">' + userRecord.displayName + '</div>' +
      '          <div id="email">' +
      userRecord.email + ' (' +
      (userRecord.emailVerified ? 'verified' : 'unverified') +
      ')</div>' +
      '          <div class="clearfix"></div>' +
      '        </div>' +
      '        <p>' +
      // Append button for sign out.
      '          <button id="sign-out"' +
      '                  onClick="window.location.assign(\'/logout\')">' +
      '            Sign Out' +
      '          </button>' +
      '        </p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '</body>' +
      '</html>';
    res.set('Content-Type', 'text/html');
    res.end(html);
  });
}

/**
 * @param {!Object} req The expressjs request.
 * @return {string} The ID token if the user is signed in.
 */
function getIdToken(req) {
  const authorizationHeader = req.headers.authorization || '';
  const components = authorizationHeader.split(' ');
  return components.length > 1 ? components[1] : '';
}

/**
 * Checks if a user is signed in and if so, redirects to profile page.
 * @param {string} url The URL to check if signed in.
 * @return {function()} The middleware function to run.
 */
function checkIfSignedIn(url) {
  return (req, res, next) => {
    if (req.url == url) {
      const idToken = getIdToken(req);
      // User already logged in. Redirect to profile page.
      admin.auth().verifyIdToken(idToken).then((decodedClaims) => {
        res.redirect('/profile');
      }).catch((error) => {
        next();
      });
    } else {
      next();
    }
  };
}

// Initialize Admin SDK.
admin.initializeApp({
  credential: admin.credential.cert('./server/serviceAccountKeys.json')
});
// Support JSON-encoded bodies.
app.use(bodyParser.json());
// Support text bodies.
app.use(bodyParser.text());
// Support URL-encoded bodies.
app.use(bodyParser.urlencoded({
  extended: true
}));
// If a user is signed in, redirect to profile page.
app.use(checkIfSignedIn('/',));
// Serve static content from public folder.
app.use('/', express.static('public'));
app.use('/styles', express.static('styles'));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname + '/../app/index.html'));
});

app.get('/unsupported', (req, res) => {
  res.sendFile(path.resolve(__dirname + '/../app/unsupported.html'));
});

/** Get profile endpoint. */
app.get('/profile', (req, res) => {
  // Get ID token.
  const idToken = getIdToken(req);
  // Get the ID token and verify it.
  admin.auth().verifyIdToken(idToken)
    .then((decodedClaims) => {
      // Serve content for signed in user.
      return serveContentForUser('/profile', req, res, decodedClaims);
    }).catch((error) => {
      // Force user to login.
      res.redirect('/');
    });
});

app.get('/logout', (req, res) => {
  const html = '<!DOCTYPE html>' +
      '<html>' +
      '<meta charset="UTF-8">' +
      '<script src="/logout.js"></script>' +
      '<body>' +
      '</body>' +
      '</html>';
  res.set('Content-Type', 'text/html');
  res.end(html);
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
