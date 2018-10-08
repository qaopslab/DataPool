//Credential manager
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const validUsers = [
];

var user = new Schema({
    username: {
        type: String,
        unique: true
    },
    password: String,
    name: String
})

var userModel = mongoose.model('users', user);

module.exports = {

    login: function (user) {
        return new Promise(function (resolve, reject) {
            userModel.findOne({
                username: user.username
            })
                .exec()
                .then((data) => {
                    if (data) {
                        bcrypt.compare(user.password, data.password)
                            .then((res) => {
                                if (!res)
                                    reject("Password is incorrect. Please try again!");
                                else
                                    resolve(data.name);
                            })
                    }
                    else {
                        reject("Username not found. You may not have signed up!")
                    }
                })
        })
    },

    signup: function (user) {
        var flag = false;
        for (var i = 0; i < validUsers.length; i++) {
            if (user.username === validUsers[i]) {
                flag = true;
                break;
            }
        }
        return new Promise(function (resolve, reject) {
            // if (!flag) {
            //     reject('Invalid username. The entered username is not corret! Use the same user as provided!');
            // }
            // else {
            bcrypt.genSalt(10, function (err, salt) { // Generate a "salt" using 10 rounds
                bcrypt.hash(user.password, salt, function (err, hash) { // encrypt the password: "myPassword123"
                    user.password = hash;
                    var newUser = new userModel({
                        username: user.username,
                        password: user.password,
                        name: user.name
                    });

                    newUser.save((err) => {
                        if (err) {
                            if (err.code == 11000) {
                                reject("User already exists with the given username");
                            } else {
                                reject("There was an error creating the user. Please try again" + err);
                            }
                        }
                        else {
                            resolve();
                        }
                    });
                });
            });
            //}
        })
    }

}