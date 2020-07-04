const { hasGenderDifference } = require('./genders')

require('./typdef')

/**
 * @param {Spawn} spawn
 * @returns {string}
 */
function getSprite (spawn) {
  const spriteParts = []
  if (spawn.gender === 'female' && hasGenderDifference(spawn.id)) {
    spriteParts.push('female')
  }
  if (spawn.shiny) {
    spriteParts.push('shiny')
  }
  spriteParts.push(spawn.id)
  const sprite = spriteParts.join('/')
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sprite}.png`
}

module.exports = {
  getSprite
}
