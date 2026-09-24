const jwt = require('jsonwebtoken');

const secretKey = process.env.SECRET_KEY || 'sakshi123'
const expiresIn = process.env.expiresIn || '1h'

module.exports = {
    generateAuthToken: (userData)=>{
        const token = jwt.sign(userData, secretKey, {expiresIn: expiresIn});

        return token
    }
}