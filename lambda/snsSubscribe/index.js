/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://aws.amazon.com/asl/                                                                                    #
#                                                                                                                    #
#  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
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
