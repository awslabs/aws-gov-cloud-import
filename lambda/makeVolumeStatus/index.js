/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();
let response = {};

exports.handler = (event, context, callback) => {
    let volumeId = event.volumeId;
    let params = {VolumeIds: [volumeId]};
    ec2.describeVolumes(params, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            //console.log(data);
            const state = data.Volumes[0].State;
            if (state == "available"){
                response.status = state;
                callback(null, response);
            } else if (state == "creating") {
                //StepFunctions will wait and check again
                response.status = state;
                callback(null, response);
            } else {
                callback(null, "failed");
            }

        }
    });
};
