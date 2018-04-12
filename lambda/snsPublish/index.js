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
let region = process.env.AWS_REGION;

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
                resolve(data);
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    //Parse for S3 Message
    if (event.s3Status == 'failed'){
        event.msg = event.topic+': Failed to copy from '+event.sourceBucket+' to '+event.destBucket+'.';
    } else if (event.s3Status == true ){
        event.msg = event.topic+': Successful copy from '+event.sourceBucket+' to '+event.destBucket+'.';
    }
    //Build SNS Topic Arn
    constructTopicArn(event.topic)
        .then(function(arn){
            //Subscribe the endpoint
            return publish(event.msg, event.topic, arn);
        })
        .then(function(msg){
            //console.log(msg);
            callback(null, msg);
        })
        .catch(function(err){
            console.log(err);
            callback(null, "failed");
        });
};
