const {Schema, Model} = require('mongoose');

const userModel = Schema(
    {
        name: {
            type: String,
            require: true
        },
        email: {
            type: String,
            require: true
        },
        password: {
            type: String
        },
        role: {
            type: String,
            require: true
        },
        isDelete: {
            type: Boolean,
            default: false
        }
    }
);

module.exports = Model(userModel, 'users')