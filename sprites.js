const { hasGenderDifference } = require('./genders')

function getSpriteURL (spawn) {
  const spriteParts = []
  if (spawn.gender === 'female' && hasGenderDifference(spawn.id)) {
    spriteParts.push('female')
  }
  if (spawn.shiny) {
    spriteParts.push('shiny')
  }
  spriteParts.push(spawn.id)
  const sprite = spriteParts.join('/')
  return `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/sprites/pokemon/${sprite}.png`
}

module.exports = {
  getSpriteURL
}
