const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT for a given user ID
 * @param {string} id - MongoDB _id of the user
 * @returns {string} signed JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = generateToken;
