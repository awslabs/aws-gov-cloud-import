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
