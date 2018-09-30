const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var processedClient = new Schema({
    "clientId": String,
    "env": String,
    "creationDate": String,
    "processCode": String,
    "caseId": String,
    "orgId": String,
    "status": {
        type: String,
        enum: ['used', 'new']
    }
},
    {
        strict: false
    });

var dataPoolModel = mongoose.model('processeddata', processedClient);

module.exports = {

    addData: function (reqData) {
        return new Promise(function (resolve, reject) {
            var data = new dataPoolModel(reqData);
            data['creationDate'] = Date(Date.now()).toString();
            data['status'] = "new";
            data.save((err) => {
                if (err) {
                    console.log(err);
                    reject("The data was not saved to the pool!");
                }
                else {
                    resolve("Data was added to the pool!");
                }
            });
        });
    },

    searchData: function (Type) {
        return new Promise(function (resolve, reject) {
            dataPoolModel.findOneAndUpdate(Type,
                {
                    $set: {
                        status: "used"
                    }
                })
                .exec()
                .then((data) => {
                    if (data) {
                        resolve(data);
                    }
                    else {
                        reject("No data available for the ProcessType: " + Type);
                    }
                });
        })
    },

    update: function (query, _status) {
        return new Promise(function (resolve, reject) {
            dataPoolModel.findOneAndUpdate(query,
                {
                    $set: {
                        status: _status
                    }
                })
                .exec()
                .then((data) => {
                    if (data) {
                        resolve("Status updated successfully!");
                    }
                    else {
                        reject("No data available for query: " + (query.orgId ? "Org ID = " + query.orgId : "Client ID = " + query.clientId));
                    }
                });
        })
    },

    count: function (query) {
        return new Promise(function (resolve, reject) {
            dataPoolModel.find(query)
                .count(function (err, count) {
                    if (count > 0) {
                        resolve(count.toString());
                    }
                    else
                        reject('0');
                })
        })
    }
}