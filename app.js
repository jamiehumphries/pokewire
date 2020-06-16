const firebase = require('@firebase/app').default
require('@firebase/auth')
firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'pokewire-db.firebaseapp.com',
  databaseURL: 'https://pokewire-db.firebaseio.com',
  projectId: 'pokewire-db',
  storageBucket: 'pokewire-db.appspot.com',
  messagingSenderId: '890801480396',
  appId: '1:890801480396:web:ba9ffd2d6e7eec5edb5869'
})

const pokewire = require('./bot')

firebase.auth().signInAnonymously().then(() => {
  pokewire.login(process.env.DISCORD_TOKEN)
})
