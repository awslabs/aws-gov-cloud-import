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
