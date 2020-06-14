const _ = require('lodash')
const pkm = require('pokemon')

const { randomGender } = require('./genders')

const SHINY_PROBABILITY = +process.env.SHINY_PROBABILITY || 0.02

function randomSpawn (maxID) {
  const id = Math.floor(Math.random() * maxID + 1)
  const name = pkm.getName(id)
  const gender = randomGender(id)
  const shiny = Math.random() < SHINY_PROBABILITY
  return { id, name, gender, shiny }
}

module.exports = {
  randomSpawn
}
