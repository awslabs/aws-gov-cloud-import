/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();

//Describe Image State
function describeImage(event){
    return new Promise(function(resolve, reject) {
        let params = {
          ImageIds: [
            event.imageNew,
          ],
        };
        ec2.describeImages(params, function(err, data) {
          if (err) {
              console.log(err);
          } // an error occurred
          else {
              console.log(data);
              resolve(data.Images[0].State);
          }
        });
    });
}

//Describe Snapshot State
function describeSnapshot(event){
    return new Promise(function(resolve, reject) {
        let params = {
            SnapshotIds: [ event.imageNew ]
        };
        ec2.describeSnapshots(params, function(err, data) {
            if (err) {
                console.log(err);
            } 
            else {
                //Use the same value as AMI for completed
                if (data.Snapshots[0].State == 'completed') {
                    const state = 'available';
                    console.log(data);
                    resolve(state);
                }
                else {
                    const state = data.Snapshots[0].State;
                    console.log(data);
                    resolve(state);
                }
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    if (event.imageNew == 'failed'){
        callback(null, "failed")
    }
    //Describe and Relay back to Stepfunctions
    if (event.imageNew.startsWith("ami")){
        describeImage(event)
            .then(function(state){
                callback(null, state);
            })
          .catch(function(err){
            console.log(err);
            callback(err);
          });
    } else if (event.imageNew.startsWith("snap")) {
        describeSnapshot(event)
            .then(function(state){
                callback(null, state);
            })
            .catch(function(err){
                console.log(err);
                callback(err);
            });
    }

};

