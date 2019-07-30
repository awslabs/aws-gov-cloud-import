/*
######################################################################################################################
#  Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

const AWS = require('aws-sdk');

//Get Commercial Buckets
function getList(paramsSSM){
    return new Promise(function(resolve, reject) {
        let s3 = new AWS.S3;
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
    getList()
      .then(function(bucketList){
        callback(null, bucketList);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });
};
