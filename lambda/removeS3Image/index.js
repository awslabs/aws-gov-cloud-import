/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
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
            govRegion = 'us-gov-east-1';
            resolve(govRegion);
        }
        console.log(govRegion);
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

//Send Import Image cmd to GovCloud
function removeImage(paramsSSM){
    return new Promise(function(resolve, reject) {
        let s3 = new AWS.S3({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
         let params = {
              Bucket: paramsSSM.s3BucketGov,
              Key: paramsSSM.volumeId
         };
        s3.deleteObject(params, function(err, data) {
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
        return removeImage(paramsSSM);
      })
      .then(function(GovCloudremove){
        let removeData = GovCloudremove;
        console.log(JSON.stringify(removeData));
        callback(null, removeData);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });

};
