/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
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
