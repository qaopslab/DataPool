const mongoose = require('mongoose');
const Schema = mongoose.Schema;
var envs = ['SIT'];

var dbConfig = new Schema({
    "dataPoolProcess": String,
    "description": String,
    "processCode": {
        type: String,
        unique: true
    },
    "requisiteCode": String,
    "dataType": String,
    "thresholdData": [
        {
            "envName": String,
            "primaryTCCount": Number,
            "secondaryTCCount": Number,
            "status": String
        }
    ]
});

var dataPoolModel = mongoose.model('dbConfigs', dbConfig);

function updateCounts(requisiteCode, counts, env) {
    var code = "";
    var tempDoc = {};
    dataPoolModel.findOne({
        processCode: requisiteCode
    })
        .exec()
        .then((doc) => {
            if (!(doc.requisiteCode == null))
                code = doc.requisiteCode;
            for (var i = 0; i < doc.thresholdData.length; i++) {
                if (doc.thresholdData[i].envName == env)
                    doc.thresholdData[i].secondaryTCCount = parseInt(doc.thresholdData[i].secondaryTCCount) + parseInt(counts);
            }
            tempDoc = doc;
        })
        .then(() => {
            tempDoc = new dataPoolModel(tempDoc);
            tempDoc.save({ _id: tempDoc._id });
        })
        .then(() => {
            if (!(code == null))
                updateCounts(code, counts, env);
        })
}

function delay(t, v) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, v), t)
    });
}

function formatData(data, env) {
    var j = 0;
    for (var i = 0; i < data.length; i++) {
        j = 0;
        while (j < data[i].thresholdData.length) {
            if (data[i].thresholdData[j].envName == env) {
                data[i].primaryTCCount = data[i].thresholdData[j].primaryTCCount;
                data[i].secondaryTCCount = data[i].thresholdData[j].secondaryTCCount;
                data[i].thresholdLimit = (data[i].primaryTCCount + data[i].secondaryTCCount) * 2;
            }
            j++;
        }
    }
    return data;
}

module.exports = {

    addProcess: function (data, env) {
        return new Promise(function (resolve, reject) {
            var temp = [];
            for (var i = 0; i < data.env.length; i++) {
                var tempObj = {};
                tempObj['envName'] = data.env[i];
                tempObj['primaryTCCount'] = 0;
                tempObj['secondaryTCCount'] = 0;
                tempObj['status'] = "Active";
                temp.push(tempObj);
            }
            var dataPoolData = new dataPoolModel({
                dataPoolProcess: data.dataPoolProcess,
                description: data.description,
                processCode: data.processCode,
                requisiteCode: data.requisiteCode,
                dataType: data.dataType,
                thresholdData: temp
            });
            dataPoolData.save((err) => {
                if (err) {
                    if (err.code == 11000) {
                        dataPoolModel.find({
                            processCode: data.processCode,
                            thresholdData: {
                                $elemMatch: {
                                    envName: { $in: data.env }
                                }
                            }
                        })
                            .exec()
                            .then((doc) => {
                                if (doc.length > 0)
                                    reject("Data could not be added! Process Type '" + data.processCode + "' already exists in the database!..");
                                else {
                                    dataPoolModel.findOneAndUpdate({
                                        processCode: data.processCode
                                    },
                                        {
                                            $push: {
                                                thresholdData: temp
                                            }
                                        })
                                        .exec()
                                        .then((done) => {
                                            if (done) {
                                                resolve("Done");
                                            }
                                            else
                                                reject("Failed to add the process for the environment " + env + "!...");
                                        })
                                }
                            })
                    }
                    else
                        reject("Unexpected error occurred! Data could not be added!\n" + err.message);
                }
                else {
                    resolve("Data added successfully!");
                }
            });
        });
    },

    editProcess: function (rawData, env) {
        var updatedDoc = {};
        return new Promise(function (resolve, reject) {
            dataPoolModel.findOne({ _id: rawData._id })
                .exec()
                .then((data) => {
                    for (var i = 0; i < data.thresholdData.length; i++) {
                        if (data.thresholdData[i].envName == env) {
                            data.thresholdData[i].primaryTCCount = parseInt(data.thresholdData[i].primaryTCCount) + parseInt(rawData.tcCount);
                            data.thresholdData[i].status = rawData.status;
                        }
                    }
                    updatedDoc = new dataPoolModel(data);
                })
                .then(() => {
                    updateCounts(updatedDoc.requisiteCode, rawData.tcCount, env)
                })
                .then(() => {
                    updatedDoc.save({ _id: rawData._id }, (err) => {
                        if (err) {
                            reject("The update process failed! " + err);
                        }
                        else {
                            resolve("Data was updated successfully!");
                        }
                    })
                })
        })
    },

    searchData: function (query, env) {
        return new Promise(function (resolve, reject) {
            dataPoolModel.find({
                thresholdData: {
                    $elemMatch: {
                        envName: env
                    }
                }
            })
                .exec()
                .then((data) => {
                    if (data.length > 0) {
                        data = formatData(data, env);
                        resolve(data);
                    }
                    else
                        reject("Unexpected error occurred!");
                })
        });
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

    count: function (query, env) {
        var flag = false;
        return new Promise(function (resolve, reject) {
            dataPoolModel.findOne(query)
                .exec()
                .then((data) => {
                    for (var i = 0; i < data.thresholdData.length; i++) {
                        if (data.thresholdData[i].envName == env) {
                            flag = true;
                            resolve((2 * (parseInt(data.thresholdData[i].primaryTCCount) + parseInt(data.thresholdData[i].secondaryTCCount))).toString());
                        }
                    }
                    if (flag)
                        reject("No data found!")
                })

        })
    }

}