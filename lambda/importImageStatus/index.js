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
const ssm = new AWS.SSM
const lambda = new AWS.Lambda();

let govRegion;
let paramsSSM = {};
let region = process.env.AWS_REGION;

//Determine which GovCloud Region we should be using
function getGovCloudRegion(){
    return new Promise(function(resolve, reject) {
        if (region == 'us-west-2') {
            govRegion = 'us-gov-west-1';
            resolve(govRegion);
        } else if (region == 'us-east-2'){
            govRegion = 'us-gov-west-1';
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

function importStatusWindows(paramsSSM){
    return new Promise(function(resolve, reject) {
        let ec2 = new AWS.EC2({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        var params = {
              ImportTaskIds: [
                paramsSSM.importTaskId
              ],
        };
        ec2.describeImportImageTasks(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log(JSON.stringify(data));
                let status = data.ImportImageTasks[0].Status;
                if (status == "completed"){
                    paramsSSM.govImageId = data.ImportImageTasks[0].ImageId;
                    resolve(status);
                } else {
                    resolve(status);
                }
            }
        });
    });
}

function importStatusLinux(paramsSSM){
    return new Promise(function(resolve, reject) {
        let ec2 = new AWS.EC2({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        var params = {
              ImportTaskIds: [
                paramsSSM.importTaskId
              ],
        };
        ec2.describeImportSnapshotTasks(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                //Grab the Snapshot Id so we can register the AMI Image
                let status = data.ImportSnapshotTasks[0].SnapshotTaskDetail.Status;
                if (status == "completed"){
                    paramsSSM.snapshotId = data.ImportSnapshotTasks[0].SnapshotTaskDetail.SnapshotId;
                    console.log(paramsSSM+"Snapshot")
                    resolve(status);
                }
                resolve(status);
            }
        });
    });
}

//Find Lambda function
function snsPublish(msg, topic){
    return new Promise((resolve, reject) => {
        //Params for Lambda invoke
        let params = {};
        // Call the Lambda function
        lambda.listFunctions(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                let length = data.Functions.length;
                for (let index = 0; index < length; ++index) {
                    let str = data.Functions[index].FunctionName;
                    if(str.startsWith("gov-cloud-import-snsPublish")){
                        //Params for Lambda invoke
                        let params = {
                            FunctionName : str,
                            InvocationType : 'RequestResponse',
                            LogType : 'Tail',
                            Payload : JSON.stringify({"msg": msg, "topic": topic})
                        };
                        //console.log(params)
                        // Call the Lambda function
                        lambda.invoke(params, function(err, data) {
                            if (err) {
                                console.log(err);
                                reject(err);
                            } else {
                                resolve(data);
                            }
                        });
                    }
                }
            }
        });
    });
}

//This is command has to be run since linux has to be imported as a snapshot, then registered.
function registerImage(paramsSSM){
    return new Promise((resolve, reject) => {
        if (paramsSSM.os == "Linux"){
            let ec2 = new AWS.EC2({
                region: paramsSSM.govRegion,
                accessKeyId: paramsSSM.accessKey,
                secretAccessKey: paramsSSM.secretKey
            });
            let params = {
                Architecture: 'x86_64',
                Name: paramsSSM.image+' from Commercial',
                BlockDeviceMappings: [
                    {
                        DeviceName: '/dev/sda1',
                            Ebs: {
                                SnapshotId: paramsSSM.snapshotId
                        }
                    },
                ],
                RootDeviceName: '/dev/sda1',
                Description: paramsSSM.image+' from Commercial',
                VirtualizationType: 'hvm'
            };
            ec2.registerImage(params, function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(data.ImageId);
                }
            });
        } else {
            resolve();
        }
    });
}

function getAmiWindows(paramsSSM){
    return new Promise(function(resolve, reject) {
        let ec2 = new AWS.EC2({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        var params = {
              ImportTaskIds: [
                paramsSSM.importTaskId
              ],
        };
        ec2.describeImportImageTasks(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data.ImportImageTasks[0].ImageId);
            }
        });
    });
}

function constructMsg(paramsSSM){
    return new Promise((resolve, reject) => {
        if (paramsSSM.status == "completed"){
            let msg = "gov-cloud-import-image: "+paramsSSM.image+" from Commercial is Completed as "+paramsSSM.govImageId+" in GovCloud";
            resolve(msg);
        } else if (paramsSSM.status == "failed"){
            let msg = "gov-cloud-import-image: "+paramsSSM.image+" from Commercial is Failed.  Please check Step Functions State Machine and logs.";
            resolve(msg);
        } else {
            resolve();
        }
    });
}

function getStatus(paramsSSM){
    return new Promise((resolve, reject) => {
        if (paramsSSM.os == "Windows"){
            resolve(importStatusWindows(paramsSSM));
        } else if (paramsSSM.os == "Linux"){
            resolve(importStatusLinux(paramsSSM));
        } else {
            resolve();
        }
    });
}

function getGovAmiId(paramsSSM){
    return new Promise((resolve, reject) => {
        if (paramsSSM.os == "Windows"){
            resolve(getAmiWindows(paramsSSM));
        } else if (paramsSSM.os == "Linux"){
            resolve(registerImage(paramsSSM));
        } else {
            resolve();
        }
    });
}

exports.handler = (event, context, callback) => {
    paramsSSM = event;
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
            return getStatus(paramsSSM);
        })
        .then(function(status){
            paramsSSM.status = status;
            //End the functions and send Step Functions back to waiting
            if (status == "active"){
                callback(null, status);
            }
            return registerImage(paramsSSM);
         })
        .then(function(govImageId){
            paramsSSM.govImageId = govImageId;
            return constructMsg(paramsSSM);
        })
        .then(function(msg){
            return snsPublish(msg, paramsSSM.topic);
        })
        .then(function(){
            callback(null, paramsSSM.status);
        })
        .catch(function(err){
            console.log(err);
            callback("failed");
      });

};
