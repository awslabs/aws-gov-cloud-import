/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

exports.handler = (event, context, callback) => {
    //Are we working with Snap or AMI?
    const snap = event.image.startsWith("snap");
    const ami = event.image.startsWith("ami");
    console.log(ami);
    console.log(snap);
    if (snap == true) {
        var params = {
            SourceRegion: event.region,
            SourceSnapshotId: event.image,
            Description: 'Temp GovCloud Import Source Snapshot',
            //DestinationRegion: 'us-east-2',
        };
        ec2.copySnapshot(params, function(err, data) {
            if (err) {
                console.log(err);
                callback(err);
            } else {
                console.log(data);
                callback(null, data.SnapshotId);
            }
        });
    } else if (ami == true) {
        //Copy AMI and callback New AMI ID
        let params = {
          Name: 'Temp GovCloud Import Source Image',
          SourceImageId: event.image,
          SourceRegion: event.region,
        };
        ec2.copyImage(params, function(err, data) {
            if (err) {
                console.log(err);
                callback(null, "failed");
            } else {
                console.log(data);
                callback(null, data.ImageId);
            }
        });
    }
};
