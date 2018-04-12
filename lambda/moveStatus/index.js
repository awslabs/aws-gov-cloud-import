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

