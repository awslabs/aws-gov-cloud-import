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

//Set Variables
var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
let snapshot;

exports.handler = (event, context, callback) => {
    //Define Delete Snapshot
    function deleteSnapshot(){
        var params = {
            SnapshotId: snapshot,
        };
        ec2.deleteSnapshot(params, function(err, data) {
            if (err) {
                console.log(err);
                callback(err);
            } else {
                console.log(data);
                callback(null, "Snapshot removed");
            }
        });
    }
    //Define where we have a Snapshot or AMI
    const snap = event.imageNew.startsWith("snap");
    const ami = event.imageNew.startsWith("ami");
    if (ami == true){
        //Find AMI Snapshot ID
        let params = {
            ImageIds: [
              event.imageNew,
            ]
        };
        ec2.describeImages(params, function(err, data) {
            if (err) {
                console.log(err);
                callback(err);
            } else {
                console.log(data);
                //Snapshot associated with AMI
                snapshot = data.Images[0].BlockDeviceMappings[0].Ebs.SnapshotId;
                //Deregister AMI and Delete Snapshot
                let params = {
                    ImageId: event.imageNew
                };
                ec2.deregisterImage(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        console.log(data);
                        deleteSnapshot();
                    }
                });
            }
        });
    } else if (snap == true) {
        snapshot = event.imageNew;
        //Delete Snapshot
        deleteSnapshot();
    } else {
        console.log("Not a valid Snapshot or AMI");
        callback(null,"Not a valid Snapshot or AMI");
    }
};
