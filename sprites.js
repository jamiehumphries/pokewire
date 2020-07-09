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
  let filename = spawn.id.toString()
  if (spawn.id === 201) {
    // Special case for Unown.
    const forms = 'abcdefghijklmnopqrstuvwxyz'
    const form = forms[Math.floor(Math.random() * 26)]
    filename += `-${form}`
  }
  filename += '.png'
  spriteParts.push(filename)
  const sprite = spriteParts.join('/')
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sprite}`
}

module.exports = {
  getSprite
}
