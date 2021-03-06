const { randomGender } = require('./genders')
const { getName } = require('./pokemon')

require('./typdef')

const SHINY_PROBABILITY = +process.env.SHINY_PROBABILITY || 0.01

/**
 * @param {number} maxId
 * @returns {Spawn}
 */
function randomSpawn (maxId) {
  const id = Math.floor(Math.random() * maxId) + 1
  const name = getName(id)
  const gender = randomGender(id)
  const shiny = Math.random() < SHINY_PROBABILITY
  const spawn = { id, name, gender, shiny }
  if (id === 132) {
    // Special handling for Ditto.
    do {
      spawn.disguise = randomSpawn(maxId)
      spawn.disguise.shiny = spawn.shiny // Prevent false Shiny Ditto.
    } while (spawn.disguise.id === 132) // Prevent Ditto disguised as Ditto.
  }
  return spawn
}

module.exports = {
  randomSpawn
}
