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
const ssm = new AWS.SSM();
let region = process.env.AWS_REGION;
let govRegion;
let status = [];
let version = {};
version.version = "1.0";
status.push(version);

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

//Get Values from Parameter Store
function getParameter(value){
    return new Promise(function(resolve, reject) {
        let params = {
            Name: value,
            WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data.Parameter.Value);
            }
        });
    });
}

//GovCloud CloudFormation Status
function govCloudFormationStatus(paramsSSM){
    return new Promise((resolve, reject) => {
        let cloudformation = new AWS.CloudFormation({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        let params = {
            StackName: 'gov-cloud-import'
        };
        let temp = {};
        cloudformation.describeStacks(params, function(err, data) {
            if (err){
                if (err && err.statusCode == '400') {
                    temp.region = paramsSSM.govRegion;
                    temp.status = "Not Installed";
                    status.push(temp);
                    resolve("Not Installed");
                } else {
                  console.log(err);
                  reject(err);
                }
            } else {
                temp.region = paramsSSM.govRegion;
                temp.status = data.Stacks[0].StackStatus;
                temp.create = data.Stacks[0].CreationTime;
                status.push(temp);
                resolve();
            }
        });
    });
}

//GovCloud CloudFormation Status
function comCloudFormationStatus(){
    return new Promise((resolve, reject) => {
        let cloudformation = new AWS.CloudFormation;
        let params = {
            StackName: 'gov-cloud-import'
        };
        let temp = {};
        cloudformation.describeStacks(params, function(err, data) {
            if (err){
                if (err && err.statusCode == '400') {
                    temp.region = process.env.AWS_REGION;
                    temp.status = "Not Installed";
                    status.push(temp);
                    resolve("Not Installed");
                } else {
                  console.log(err);
                  reject(err);
                }
            } else {
                temp.region = process.env.AWS_REGION;
                temp.status = data.Stacks[0].StackStatus;
                temp.create = data.Stacks[0].CreationTime;
                status.push(temp);
                resolve();
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    let paramsSSM = event;
    getParameter("gov-cloud-import-accessKey")
       .then(function(accessKey){
         paramsSSM.accessKey = accessKey;
         return getParameter("gov-cloud-import-secretKey");
      })
      .then(function(secretKey){
        paramsSSM.secretKey = secretKey;
        return getParameter("gov-cloud-import-s3Bucket");
      })
      .then(function(s3BucketGov){
        paramsSSM.s3BucketGov = s3BucketGov;
        return getGovCloudRegion();
      })
      .then(function(govRegion){
        paramsSSM.govRegion = govRegion;
        return govCloudFormationStatus(paramsSSM);
      })
      .then(function(){
        return comCloudFormationStatus();
      })
      .then(function(){
        callback(null, status);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });

};
