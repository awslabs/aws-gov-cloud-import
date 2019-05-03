/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

const AWS = require('aws-sdk');
let sns = new AWS.SNS();
let sts = new AWS.STS();

function constructTopicArn(region, topic) {
    return new Promise((resolve, reject) => {
        let callerParams = {
        };
        //Use STS to find the account number
        sts.getCallerIdentity(callerParams, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                let arn = 'arn:aws:sns:'+region+':'+data.Account+':'+topic;
                console.log(arn);
                resolve(arn);
            }
        });
    });
}
function subscribe(protocol, topicArn, endpoint) {
    return new Promise((resolve, reject) => {
        var params = {
              Protocol: protocol,
              TopicArn: topicArn,
              Endpoint: endpoint
        };
        sns.subscribe(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log(data);
                resolve("Subscription Successful for "+endpoint);
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    //Build SNS Topic Arn
    constructTopicArn(event.region, event.topic)
        .then(function(topicArn){
            //Subscribe the endpoint
            return subscribe(event.protocol, topicArn, event.endpoint);
        })
        .then(function(msg){
            console.log(msg);
            callback(null, msg);
        })
        .catch(function(err){
            console.log(err);
            callback(null, "failed");
        });
};
