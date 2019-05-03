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
let region = process.env.AWS_REGION;
let govRegion;
let msg;

//Determine which GovCloud Region we should be using
function getGovCloudRegion(){
    return new Promise(function(resolve, reject) {
        if (region == 'us-west-2') {
            govRegion = 'us-gov-west-1';
            resolve(govRegion);
        } else if (region == 'us-east-2'){
            govRegion = 'us-gov-east-1';
            resolve(govRegion);
        }
    });
}

function constructTopicArn(topic) {
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
                resolve(arn);
            }
        });
    });
}

function publish(msg, topic, arn) {
    return new Promise((resolve, reject) => {
        let params = {
          Message: msg,
          Subject: topic,
          TopicArn: arn
        };
        sns.publish(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log(data);
                resolve(data);
            }
        });
    });
}

function constructMsg(event) {
    return new Promise((resolve, reject) => {
        if (event.topic == "gov-cloud-import-image"){
            if (event.importImageStatus == "completed"){
                let msg = JSON.stringify({"sourceRegion": event.region, "source": event.image, "destRegion": govRegion, "dest": event.govImageId});
                resolve(msg);
            } else if (event.importImageStatus == "failed" || event.status == "failed" || event.volume.status == "failed" || event.s3Status == "failed" ){
                let msg = JSON.stringify({"sourceRegion": event.region, "source": event.image, "destRegion": govRegion, "dest": "failed"});
                resolve(msg);
            }
        } else if (event.topic == "gov-cloud-import-s3"){
            if (event.s3Status == 'failed'){
                let msg = JSON.stringify({"sourceRegion": event.region, "source": event.sourceBucket, "destRegion": govRegion, "dest": "failed"});
                resolve(msg);
            } else if (event.s3Status == true ){
                let msg = JSON.stringify({"sourceRegion": event.region, "source": event.sourceBucket, "destRegion": govRegion, "dest": event.destBucket});
                resolve(msg);
            }
        }
    });
}
exports.handler = (event, context, callback) => {
        console.log(event);
    getGovCloudRegion()
        .then(function(){
            return constructTopicArn(event.topic);
        })
        .then(function(arn){
            event.arn = arn;
            //Create SNS Msg
            return constructMsg(event);
        })
        .then(function(msg){
            //Publish to SNS
            console.log(msg);
            return publish(msg, event.topic, event.arn);
        })
        .then(function(){
            callback(null, msg);
        })
        .catch(function(err){
            console.log(err);
            callback(null, "failed");
        });
};
