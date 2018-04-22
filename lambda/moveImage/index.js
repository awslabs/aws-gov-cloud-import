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
