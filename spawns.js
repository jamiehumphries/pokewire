const pkm = require('pokemon')

const { randomGender } = require('./genders')

require('./typdef')

const SHINY_PROBABILITY = +process.env.SHINY_PROBABILITY || 0.02

/**
 * @param {number} maxId
 * @returns {Spawn}
 */
function randomSpawn (maxId) {
  const id = Math.floor(Math.random() * maxId) + 1
  if (id === 132) {
    // Re-roll if Ditto until special handling is in place.
    return randomSpawn(maxId)
  }
  const name = pkm.getName(id)
  const gender = randomGender(id)
  const shiny = Math.random() < SHINY_PROBABILITY
  return { id, name, gender, shiny }
}

module.exports = {
  randomSpawn
}
