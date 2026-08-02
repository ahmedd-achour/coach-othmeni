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
   apiConfig: {
    coachName: 'Aymen Othmani',
    businessName: 'Carthage Athletica',
    coachPhone: '',
    leadHours: 2,
    smsMode: 'firebase',
    brevoApiKey: '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',
    brevoSenderEmail: 'service@xschnell.com'
  },

  createPaymentIntentUrl:
    "https://us-central1-coach-othmeni.cloudfunctions.net/createPaymentIntent",

  verifyPaymentUrl:
    "https://us-central1-coach-othmeni.cloudfunctions.net/verifyPaymentAndSave"





};
