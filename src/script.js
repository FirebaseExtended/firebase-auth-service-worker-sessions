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

import firebase from 'firebase/app';
import 'firebase/auth';
import * as firebaseui from 'firebaseui';
import * as config from './config.js';

/**
 * @return {!Object} The FirebaseUI config.
 */
function getUiConfig() {
  // This configuration supports email/password and Google providers.
  return {
    'callbacks': {
      // Called when the user has been successfully signed in.
      'signInSuccessWithAuthResult': (userCredential, redirectUrl) => {
        console.log('redirect to /profile');
        // Redirect to profile on success.
        window.location.assign('/profile');
        // Do not automatically redirect.
        return false;
      },
      'uiShown': () => {
        // Remove progress bar when the UI is ready.
        document.getElementById('loading').classList.add('hidden');
      }
    },
    'signInFlow': 'popup',
    'signInOptions': [
      {
        provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID
      },
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        // Whether the display name should be displayed in Sign Up page.
        requireDisplayName: true
      }
    ],
    // Terms of service url.
    'tosUrl': 'https://www.google.com',
    'privacyPolicyUrl': 'https://www.google.com',
    'credentialHelper': firebaseui.auth.CredentialHelper.NONE
  };
}

// Install servicerWorker if supported.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', {scope: '/'})
      .then((reg) => {
        // Registration worked.
        console.log('Registration succeeded. Scope is ' + reg.scope);
      }).catch((error) => {
        // Registration failed.
        console.log('Registration failed with ' + error.message);
      });
} else {
  window.location.assign('/unsupported');
}

/**
 * Initializes the app.
 */
const initApp = () => {
  // Renders sign-in page using FirebaseUI.
  ui.start('#firebaseui-container', getUiConfig());
};
// Initialize Firebase app.
var app = firebase.initializeApp(config);
// Set persistence to none.
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
// Initialize the FirebaseUI Widget using Firebase.
const ui = new firebaseui.auth.AuthUI(app.auth());
// On page ready, initialize app.
window.addEventListener('load', initApp);
