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
const ssm = new AWS.SSM();

let keyName = "gov-cloud-import-ec2-"+process.env.AWS_REGION;
let ami;
let userDataEncoded;
let region = process.env.AWS_REGION;
let ec2param = {};
if (region == 'us-west-2') {
    ami = 'ami-32cf7b4a';
} else if (region == 'us-east-2'){
    ami = 'ami-caaf84af';
}

//Test if object is empty
function isEmpty(obj) {
      for(let key in obj) {
          if(obj.hasOwnProperty(key))
              return false;
      }
      return true;
}

//User Data Script for EC2
function findEC2PrepScript() {
    return new Promise(function(resolve, reject) {
        let params = {
              Name: 'gov-cloud-import-app',
              WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                //let url = 'https://s3.'+region+'.amazonaws.com/'+data.Parameter.Value+'/ec2/gov-cloud-import-ec2prep.sh'
                let s3 = 's3://'+data.Parameter.Value+'/ec2/gov-cloud-import-ec2prep.sh';
                let userData=
                    `#!/bin/bash
                    aws s3 cp ${s3} ./
                    chmod +x gov-cloud-import-ec2prep.sh
                    ./gov-cloud-import-ec2prep.sh
                    `;
                //Base64 Encode User Data
                userDataEncoded = new Buffer(userData).toString('base64');
                //Resolve with Parameter Value
                resolve(userDataEncoded);
            }
        });
    });
}

function findKeyPair(){
    return new Promise(function(resolve, reject) {
        var params = {
            Filters: [
                { Name: 'key-name',
                  Values: ['gov-cloud-import-ec2-*',]
                }
            ]
        };
        ec2.describeKeyPairs(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function createKeyPair(){
    return new Promise(function(resolve, reject) {
        var params = {
            KeyName: keyName
        };
        ec2.createKeyPair(params, function(err, data) {
            if (err) {
                reject(err, err.stack);
            } else {
                var paramsSSM = {
                  Name: keyName,
                  Type: 'SecureString',
                  Value: data.KeyMaterial,
                  Overwrite: true
                };
                ssm.putParameter(paramsSSM, function(err, data) {
                   if (err) {
                        console.log(err);
                        reject(err);
                    } else {
                        console.log(data);
                        resolve(data);
                    }
                });
            }
        });
    });
}

function findRoleArn() {
    return new Promise(function(resolve, reject) {
        let params = {
              Name: 'gov-cloud-import-ec2RoleArn',
              WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                //Resolve with Parameter Value
                resolve(data.Parameter.Value);
            }
        });
    });
}

function findSecurityGroup() {
    return new Promise(function(resolve, reject) {
        let params = {
              Name: 'gov-cloud-import-sg',
              WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                //Resolve with Parameter Value
                resolve(data.Parameter.Value);
            }
        });
    });
}

//Find any running Instance
function describeInst(){
    return new Promise(function(resolve, reject) {
        let params = {
            Filters: [
                { Name: 'tag:gov-cloud-import',
                  Values: ['true']
                },
                { Name: 'instance-state-name',
                  Values: ['running', 'pending', 'stopped']
                }
            ]
        };
        ec2.describeInstances(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

//Start a stopped instance
function startInst(instanceId){
    return new Promise(function(resolve, reject) {
        let params = {InstanceIds: [instanceId]};
        ec2.startInstances(params, function(err, data) {
            if (err) {
              console.log(err);
              reject(err);
            } else {
               console.log(data);
               //Respond with pending so we check on it again
               resolve("pending");
            }
        });
    });
}

//Run New Instance
function runInst(){
    return new Promise(function(resolve, reject) {
        let paramsSub = {
        Filters: [
                { Name: 'tag:gov-cloud-import',
                  Values: ['true']
                }
            ]
        };
        ec2.describeSubnets(paramsSub, function(err, data) {
            if (err) {
                reject(err, err.stack);
            } else {
                const subnetId = data.Subnets[0].SubnetId;
                let params = {
                    MaxCount: 1,
                    MinCount: 1,
                    ImageId: ami,
                    InstanceType: "m5.large",
                    KeyName: keyName,
                    IamInstanceProfile: {
                        Arn: ec2param.arn,
                    },
                    SubnetId: subnetId,
                    SecurityGroupIds: [ec2param.sg],
                    TagSpecifications: [
                        { ResourceType: "instance",
                            Tags: [
                                { Key: 'gov-cloud-import',
                                    Value: 'true'
                                },
                                { Key: 'Name',
                                    Value: 'gov-cloud-import-ec2'
                                }
                            ]
                        },
                    ],
                    UserData: userDataEncoded
                };
                ec2.runInstances(params, function(err, data) {
                if (err) {
                        console.log(err);
                        reject(err);
                    } else {
                        //Respond with pending so we'll check on it again
                        resolve("pending");
                    }
                });
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    findEC2PrepScript();
    findKeyPair()
        .then(function(findPair){
            if(isEmpty(findPair.KeyPairs)){
                createKeyPair();
            } else {
                ec2param.keyName = findPair.KeyPairs[0].KeyName;
            }
            return findRoleArn();
        })
        .then(function(arn){
            ec2param.arn = arn;
            return findSecurityGroup();
        })
        .then(function(sg){
            ec2param.sg = sg;
            return describeInst();
        })
        .then(function(data){
            //If none, run a new instance
            if (isEmpty(data.Reservations)){
                return runInst();
            } else {
                //If exists, set state.
                const instanceId = data.Reservations[0].Instances[0].InstanceId;
                const instanceState = data.Reservations[0].Instances[0].State.Name;
                if (instanceState == 'pending') {
                    callback(null, "pending");
                } else if (instanceState == 'running'){
                    callback(null, "running");
                } else if (instanceState == 'stopped'){
                    return startInst(instanceId);
                }
            }
        })
        .then(function(data){
            callback(null, data);
        })
        .catch(function(err){
            console.log(err);
            callback(err);
        });
};
