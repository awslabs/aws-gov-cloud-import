/*
######################################################################################################################
#  Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
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
let govRegion;
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

//Import Image cmd to GovCloud - Windows
function importWindows(paramsSSM){
    return new Promise(function(resolve, reject) {
        let ec2 = new AWS.EC2({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        let params = {
            Description: 'Import: '+paramsSSM.image+' from '+paramsSSM.region,
            DiskContainers: [
            {
                Description: 'Import: '+paramsSSM.image+' from '+paramsSSM.region,
                Format: 'RAW',
                UserBucket: {
                  S3Bucket: paramsSSM.s3BucketGov,
                  S3Key: paramsSSM.volumeId
                }
            },
            ],
            LicenseType: 'BYOL',
            Platform: paramsSSM.os,
        };
        ec2.importImage(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

//Import Image cmd to GovCloud - Linux
function importLinux(paramsSSM){
    return new Promise(function(resolve, reject) {
        let ec2 = new AWS.EC2({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        let params = {
            Description: 'Import: '+paramsSSM.image+' from '+paramsSSM.region,
            DiskContainer: {
                Description: 'Import: '+paramsSSM.image+' from '+paramsSSM.region,
                Format: 'RAW',
                UserBucket: {
                    S3Bucket: paramsSSM.s3BucketGov,
                    S3Key: paramsSSM.volumeId
                }
            }
        };
        ec2.importSnapshot(params, function(err, data) {
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
        if (paramsSSM.os == "Windows"){
            return importWindows(paramsSSM);
        } else if (paramsSSM.os == "Linux"){
            return importLinux(paramsSSM);
        }
      })
      .then(function(importData){
        console.log(JSON.stringify(importData));
        callback(null, importData.ImportTaskId);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });

};
