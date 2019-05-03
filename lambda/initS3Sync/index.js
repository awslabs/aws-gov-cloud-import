/*
######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################
*/

// Load the AWS SDK
const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const stepfunctions = new AWS.StepFunctions();

//Find StateMachine's ARN to start workflow
function findStateMchineArn() {
    return new Promise(function(resolve, reject) {
        let params = {};
        stepfunctions.listStateMachines(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } // an error occurred
            else {
                let length = data.stateMachines.length;
                for (let index = 0; index < length; ++index) {
                    let str = data.stateMachines[index].name;
                    if(str.startsWith("s3Sync")){
                        resolve(data.stateMachines[index].stateMachineArn);
                    }
                }
                resolve(data);
            }
        });
    });
}
//Execute the workflow with parameters
function execStateMachine(myString, arn){
    return new Promise(function(resolve, reject) {
          //Set params for Step Functions Exec
        const params = {
            stateMachineArn: arn,
            input: myString
        };

        //Exec Step Function
        stepfunctions.startExecution(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } // an error occurred
            else {
                console.log(data);
                resolve(data);
            }
        });
    });
}

exports.handler = (event, context, callback) => {
    // Input into JSON to Pass to Step Functions
    const myObject = {
      'sourceBucket': event.source,
      'destBucket' : event.dest,
      'waitEc2' : '120',
      'topic' : 'gov-cloud-import-s3'
    };

    // Convert to string
    const myString = JSON.stringify(myObject);
    findStateMchineArn()
        .then(function(arn){
            //Get ARN
            let arnStateMachine = arn;
            return execStateMachine(myString, arnStateMachine);
        })
        .then(function(data){
            callback(null, data);
        })
        .catch(function(err){
            console.log(err);
            callback(err);
        });


};
