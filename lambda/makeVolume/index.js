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
let az;

//Find EC2 Worker Subnet
function findSubnet(){
    return new Promise(function(resolve, reject) {
        let params = {
          Filters: [
            {
              Name: 'tag:gov-cloud-import',
              Values: [
                'true',
              ]
            },
          ],
        };
        ec2.describeSubnets(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log(data);
                const az = data.Subnets[0].AvailabilityZone;
                resolve(az);
            }
        });
    });
}

//Describe AMI to find Snapshot or relay given snap id
function getSnapshotId(event){
    return new Promise(function(resolve, reject) {
        if (event.imageNew.startsWith("ami") == true){
            let params = {
                DryRun: false,
                ImageIds: [
                    event.imageNew,
                ],
            };
            ec2.describeImages(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    const snapshot = data.Images[0].BlockDeviceMappings[0].Ebs.SnapshotId;
                    console.log(data);
                    resolve(snapshot);
                }
            });
        } else if (event.imageNew.startsWith("snap") == true) {
            resolve(event.imageNew);
        }
    });
}

//Make Volume to attach to EC2 Worker
function makeVolume(az, snapshotId){
    return new Promise(function(resolve, reject) {
        let params = {
            AvailabilityZone: az,
            SnapshotId: snapshotId,
            TagSpecifications: [
              {
                ResourceType: 'volume',
                Tags: [
                  {
                    Key: 'gov-cloud-import',
                    Value: 'true'
                  },
                ]
              },
            ],
        };
        ec2.createVolume(params, function(err, data) {
            if (err) {
                console.log(err);
            }
            else {
                console.log(data);
                resolve(data.VolumeId);
            }
        });

    });
}

exports.handler = (event, context, callback) => {
    findSubnet()
       .then(function(data){
         az = data;
         return getSnapshotId(event);
      })
      .then(function(snapshotId){
        return makeVolume(az, snapshotId);
      })
      .then(function(volumeId){
        callback(null, volumeId);
      })
      .catch(function(err){
        console.log(err);
        callback(err);
      });
};

