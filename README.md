# Firebase Auth Session Management with Service Workers

This sample app demonstrates how to use Firebase Auth with service workers to
manage user sessions.

## Table of Contents

1. [Developer Setup](#developer-setup)
  1. [Dependencies](#dependencies)
  1. [Configuring the app](#configuring-the-app)
  1. [Building Sample app](#building-sample-app)
  1. [Deploy to App Engine Flexible Environment](#deploy-to-app-engine-flexible-environment)
2. [Overview](#overview)

## Status

![Status: Experimental](https://img.shields.io/badge/Status-Experimental-blue)

This repository is maintained by Googlers but is not a supported Firebase product.  Issues here are answered by maintainers and other community members on GitHub on a best-effort basis.

## Developer Setup

### Dependencies

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

Download the sample application source and its dependencies with:

```bash
git clone
https://github.com/FirebaseExtended/firebase-auth-service-worker-sessions
cd firebase-auth-service-worker-sessions
npm install
```

### Configuring the app

Create your project in the [Firebase
Console](https://console.firebase.google.com).

[Add Firebase to your app](https://firebase.google.com/docs/web/setup).

Enable the **Google** and **Email/Password** sign-in providers in the
**Authentication > SIGN-IN METHOD** tab.

In the `./firebase-auth-service-worker-sessions/src` folder, create a `config.js` file:

```javascript
module.exports = {
  apiKey: '...',
  authDomain: '...',
  databaseURL: '...',
  storageBucket: '...',
  messagingSenderId: ''
};
```
Copy and paste the Web snippet code configuration found in the console to the
`config.js` file.
You can find the snippet by clicking the "Web setup" button in the Firebase
Console Authentication page.

Ensure the application authorized domain is also whitelisted. `localhost`
should already be set as an authorized OAuth domain.

Since the application is using the Firebase Admin SDK, service account
credentials will be required. Learn more on how to
[add the Firebase Admin SDK to your server](https://firebase.google.com/docs/admin/setup).

After you generate a new private key, save it in the root folder
`./firebase-auth-service-worker-sessions/server` as `serviceAccountKeys.json`.
Make sure to keep these credentials secret and never expose them in public.

### Building Sample app

To build and run the sample app, run:

```bash
npm start
```

This will launch a local server using port 8080.
To access the app, go to [http://localhost:8080/](http://localhost:8080)

### Deploy to App Engine Flexible Environment

To deploy the same app to Google App Engine flexible environment, follow the
following instructions:

- Create a GCP project in the [Google Cloud Console](https://console.cloud.google.com/).
- Run the following command in the root folder to configure your GCP project
  for the sample app. Make sure you select the project you created above.
  You will need to install [gcloud SDK](https://cloud.google.com/sdk/gcloud/) before you
  do so.

  ```bash
  gcloud init
  ```
- Deploy the sample app by running the following in the root folder.

  ```bash
  gcloud app deploy
  ```
  This will launch your sample app at `http://[YOUR_PROJECT_ID].appspot.com`.

  Make sure you whitelist the sample app domain as an authorized OAuth domain
  in the Firebase Console.

To learn more about Google App Engine Node.js flexible envionment, refer to
the [online documentation](https://cloud.google.com/appengine/docs/flexible/nodejs/).

## Overview

The application demonstrates how Firebase Auth can be used to manage user
sessions using service workers without having to set session cookies.

Firebase Auth is optimized to run on the client side. Tokens are saved in
web storage. This makes it easy to also integrate with other Firebase services
such as Realtime Database, Cloud Firestore, Cloud Storage, etc.
To manage sessions from a server side perspective, ID tokens have to be
retrieved and passed to the server.

```javascript
firebase.auth().currentUser.getIdToken()
  .then((idToken) => {
    // idToken can be passed back to server.
  })
  .catch((error) => {
    // Error occurred.
  });
```

However, this means that some script
has to run from the client to get the latest ID token and then pass it to
the server via the header, POST body, etc.

This may not scale and instead server side session cookies may be needed.
ID tokens can be set as session cookies but these are short lived and will
need to be refreshed from the client and then set as new cookies on expiration
which may require an additional round trip if the user had not visited the
site in a while.

While Firebase Auth provides a more traditional
[cookie based session management solution](https://firebase.google.com/docs/auth/admin/manage-sessions),
this solution works best for server side `httpOnly` cookie based applications
and is harder to manage as the client tokens and server side tokens could get
out of sync, especially if you also need to use other client based Firebase
services.

Instead, service workers can be used to manage user sessions for server side
consumption. This works because of the following:

- Service workers have access to the current Firebase Auth state. The current
user ID token can be retrieved from the service worker. If the token is
expired, the client SDK will refresh it and return a new one.
- Service workers can intercept fetch requests and modify them.

After a service worker is installed on the client side (sign-in page),

```javascript
// Install servicerWorker if supported on sign-in/sign-up page.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', {scope: '/'});
}
```

All fetch requests to the app's origin will be intercepted and if an ID token
is available, appended to the request via the header. Server side, request
headers will be checked for the ID token, verified and processed.
In the service worker script, the fetch request would be intercepted and
modified.

```javascript
// In service worker script.

// Get underlying body if available. Works for text and json bodies.
const getBodyContent = (req) => {
  return Promise.resolve().then(() => {
    if (req.method !== 'GET') {
      if (req.headers.get('Content-Type').indexOf('json') !== -1) {
        return req.json()
          .then((json) => {
            return JSON.stringify(json);
          });
      } else {
        return req.text();
      }
    }
  }).catch((error) => {
    // Ignore error.
  });
};

self.addEventListener('fetch', (event) => {
  const requestProcessor = (idToken) => {
    let req = event.request;
    let processRequestPromise = Promise.resolve();
    // For same origin https requests, append idToken to header.
    if (self.location.origin == getOriginFromUrl(event.request.url) &&
        (self.location.protocol == 'https:' ||
         self.location.hostname == 'localhost') &&
        idToken) {
      // Clone headers as request headers are immutable.
      const headers = new Headers();
      for (let entry of req.headers.entries()) {
        headers.append(entry[0], entry[1]);
      }
      // Add ID token to header. We can't add to Authentication header as it
      // will break HTTP basic authentication.
      headers.append('Authorization', 'Bearer ' + idToken);
      processRequestPromise = getBodyContent(req).then((body) => {
        try {
          req = new Request(req.url, {
            method: req.method,
            headers: headers,
            mode: 'same-origin',
            credentials: req.credentials,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            body,
            bodyUsed: req.bodyUsed,
            context: req.context
          });
        } catch (e) {
          // This will fail for CORS requests. We just continue with the
          // fetch caching logic below and do not pass the ID token.
        }
      });
    }
    return processRequestPromise.then(() => {
      return fetch(req);
    });
  };
  // Try to fetch the resource first after checking for the ID token.
  event.respondWith(getIdToken().then(requestProcessor, requestProcessor));
});
```

As a result, all authenticated requests will always have an ID token passed in
the header without additional processing.

In order for the service worker to detect Auth state changes, it has to be
installed typically on the sign-in/sign-up page. After installation, the service
worker has to call `clients.claim()` on activation so it can be setup as
controller for the current page.

```javascript
// In service worker script.
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
```

When the user is signed in and redirected to another page, the service worker
will be able to inject the ID token in the header before the redirect completes.

```javascript
// Sign in screen.
firebase.auth().signInWithEmailAndPassword(email, password)
  .then((result) => {
    // Redirect to profile page after sign-in. The service worker will detect
    // this and append the ID token to the header.
    window.location.assign('/profile');
  })
  .catch((error) => {
    // Error occurred.
  });
```

The server side code will be able to detect it on every request.

```javascript
// Server side code.
function getIdToken(req) {
  const authorizationHeader = req.headers.authorization || '';
  const components = authorizationHeader.split(' ');
  return components.length > 1 ? components[1] : '';
}

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

// If a user is signed in, redirect to profile page.
app.use(checkIfSignedIn('/',));
```

In addition, since ID tokens will be set via the service workers, and service
workers are restricted to run from the same origin, there is no risk of CSRF
since a website of different origin attempting to call your endpoints will
fail to invoke the service worker, causing the request to appear
unauthenticated from the server's perspective.

While service workers are now supported in all modern major browsers, some
older browsers still do not support them. As a result, some fallback may be
needed to pass the ID token to your server when service workers are not
available.

The sample app has been tested for the following desktop browsers that support
service workers.

| Browser | Version |
|---------|---------|
| Chrome  | 68+     |
| Firefox | 61+     |
| Safari  | 11.1.2  |
| Edge    | 17+     |

Learn more about about browser support for service worker at
[caniuse.com](https://caniuse.com/#feat=serviceworkers).
