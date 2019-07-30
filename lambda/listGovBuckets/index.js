/*
######################################################################################################################
#  Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
let govRegion;

//Determine which GovCloud Region we should be using
function getGovCloudRegion(){
    return new Promise(function(resolve, reject) {
        let region = process.env.AWS_REGION;
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

//Get gov-cloud-import-user GovCloud S3 Sync target buckets
function getList(paramsSSM){
    return new Promise(function(resolve, reject) {
        let s3 = new AWS.S3({
            region: paramsSSM.govRegion,
            accessKeyId: paramsSSM.accessKey,
            secretAccessKey: paramsSSM.secretKey
        });
        s3.listBuckets(function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                let length = data.Buckets.length;
                let bucketList = [];
                for (let index = 0; index < length; ++index) {
                    bucketList[index] = data.Buckets[index].Name;
                }
                console.log(bucketList)
                resolve(bucketList);
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
        return getGovCloudRegion();
      })
      .then(function(govRegion){
        paramsSSM.govRegion = govRegion;
        return getList(paramsSSM);
      })
      .then(function(bucketList){
        callback(null, bucketList);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });

};
