export const environment = {
  production: false,

  firebaseConfig: {
    apiKey: "AIzaSyCt7vrRTuIi7W8j_rSes4K-ZX7X13tRDWU",
    authDomain: "coach-othmeni.firebaseapp.com",
    projectId: "coach-othmeni",
    storageBucket: "coach-othmeni.firebasestorage.app",
    messagingSenderId: "356529399765",
    appId: "1:356529399765:web:1a04ecd5a56b0fefbdbf5c"
  },

  createPaymentIntentUrl:
    "https://us-central1-coach-othmeni.cloudfunctions.net/createPaymentIntent",

  verifyPaymentUrl:
    "https://us-central1-coach-othmeni.cloudfunctions.net/verifyPaymentAndSave"
};
    apiBaseUrl: 'http://localhost:3000' ;  // ←←← This is what we use
