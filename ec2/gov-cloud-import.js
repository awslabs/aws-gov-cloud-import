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

//For S3FS mounting via shell
let exec = require('executive');
//S3 Client that allow for synchronizng
let s3 = require('s3-node-client');
//For HTTP Requests
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
//Get HTTP Function
function httpGet(theUrl) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

//Find az and make region
let az = httpGet("http://169.254.169.254/latest/meta-data/placement/availability-zone");
let region = az.slice(0, -1);
AWS.config.update({region: region});
let instanceId = httpGet("http://169.254.169.254/latest/meta-data/instance-id");

//StepFunctions Heartbeat
let heartbeat = [];

//Find the GovCloud region based on Instance Region
if (region == 'us-west-2') {
    let govRegion = 'us-gov-west-1';
} else if (region == 'us-east-2'){
    let govRegion = 'us-gov-west-1';
}

//For Reading Mount Point and Writing Logs
const fs = require('fs');

//Create AWS Objects
const sts = new AWS.STS();
const ec2 = new AWS.EC2();
const ssm = new AWS.SSM();
const stepfunctions = new AWS.StepFunctions();

//Setting Scripts Inital Timers
let now = Date.now();
let stopScriptTime = now + 7200000;

//Reset timers for when to quit; 1 hour from last copy
function setTime() {
    now = Date.now();
    stopScriptTime = now + 7200000;
}

//Test if object is empty
function isEmpty(obj) {
    for(let key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

//Format HttpUploadProgress Size
function formatBytes(a, b) {
    if (0 == a) return "0 Bytes";
    let c = 1024,
        d = b || 2,
        e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f];
}

//An app has got to log!
function writeToLog(logInfo){
    let d = new Date();
    fs.appendFile('/home/ec2-user/log', d.toString()+" "+logInfo+"\n", function (err) {
        if (err) throw err;
    });
}

//An app has got to log!
function writeToSyncLog(logInfo){
    let d = new Date();
    fs.appendFile('/home/ec2-user/s3SyncLog', d.toString()+" "+logInfo+"\n", function (err) {
        if (err) throw err;
    });
}

//An app has got to log!
function writeToLog2(logInfo, logName){
    let d = new Date();
    fs.appendFile('/home/ec2-user/'+logName, d.toString()+" "+logInfo+"\n", function (err) {
        if (err) throw err;
    });
}


//Timeout to allow for volume attach time
const timeout = ms => new Promise(res => setTimeout(res, ms))

//Find available drive letter
function findLetter(volumeId){
    return new Promise((resolve, reject) => {
        let paramsInst = {
              Filters: [
                { Name: 'tag:gov-cloud-import',
                  Values: ['true']
                },
                { Name: 'instance-state-name',
                  Values: ['running']
                }
            ]
        };
        ec2.describeInstances(paramsInst, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                //Construct an array of mounted drives so when know which letter to use for mounting
                const instanceId = data.Reservations[0].Instances[0].InstanceId;
                let length = data.Reservations[0].Instances[0].BlockDeviceMappings.length;
                let mountedDrives = [];
                for (let index = 0; index < length; ++index) {
                    let drive = data.Reservations[0].Instances[0].BlockDeviceMappings[index].DeviceName;
                    let lastChar = drive.substr(drive.length - 1);
                    mountedDrives[index] = lastChar;
                }
                //Possible letters for mounting volume
                let driveLetters = ['f','g','h','i','j','k','l','m',];
                //If we max the connected volumes, send back a note
                if (mountedDrives.length >= 9){
                    callback(null, "Max number of connected volumes.  Restart Import.")
                }

                //Removing the mounted drive letters from possibilities
                for (let i=0; i< mountedDrives.length; i++) {
                    let index = driveLetters.indexOf(mountedDrives[i]);
                    if (index > -1) {
                        driveLetters.splice(index, 1);
                  }
                }
                //Pick a letter
                const device = '/dev/sd'+driveLetters[0];
                resolve(device);
            }
        });
    });
}

//Attach Volume
function attachVolume(taskData, instanceId){
    return new Promise((resolve, reject) => {
        let paramsAttach = {
            Device: taskData.device,
            InstanceId: instanceId,
            VolumeId: taskData.volumeId
        };
        ec2.attachVolume(paramsAttach, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
                reject(err);
            } else {
                writeToLog(JSON.stringify(data));
                resolve("success");
            }
        });
    });
}
//Detach Volume
function detachVolume(volumeId){
    return new Promise((resolve, reject) => {
        let params = {
            VolumeId: volumeId
        };
        ec2.detachVolume(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
                reject(err);
            } else {
                writeToLog(JSON.stringify(data));
                return volumeId
            }
        });
    });
}

//Delete Volume
function deleteVolume(volumeId){
    let params = {
        VolumeId: volumeId
    };
    ec2.deleteVolume(params, function(err, data) {
        if (err) {
            writeToLog(JSON.stringify(err));
        } else {
            writeToLog(JSON.stringify(volumeId+" has been detached and deleted."));
        }
    });

}

//Tie Detach and Delete together so we can time it
function removeVolume(volumeId){
  detachVolume(volumeId);
  //Give detached time to fully detach
  setTimeout(deleteVolume, 10000, volumeId);
}

//Remove Orphaned Volumes from Failed Tasks
function orphanedVolumes(){
    //Find the Root Vol to avoid error
    fs.readFile('./rootVol', 'utf8', function(err, contents) {
        let rootVol = contents.replace(/\r?\n|\r/g,'');
        let paramsInst = {
              Filters: [
                { Name: 'tag:gov-cloud-import',
                  Values: ['true']
                },
                { Name: 'instance-state-name',
                  Values: ['running']
                }
            ]
        };
        //Get the list of attached volumes
        ec2.describeInstances(paramsInst, function(err, data) {
            if (err) {
                writeToLog(err, err.stack); // an error occurred
            } else {
              let length = data.Reservations[0].Instances[0].BlockDeviceMappings.length;
              for (let index = 0; index < length; ++index) {
                  let drive = data.Reservations[0].Instances[0].BlockDeviceMappings[index].Ebs.VolumeId;
                  writeToLog("Detaching orphan volume: "+drive);
                  if (drive != rootVol){
                      removeVolume(drive);
                  }
              }
            }
        });
    });
}

//Remove from Heartbeat array
function removeHeartbeat(array, element) {
    const index = array.indexOf(element);
    if (index !== -1) {
        array.splice(index, 1);
    }
    writeToLog("Heartbeat removed");
}

//Construct each Heartbeat
function heartbeatFunc(taskToken){
    let paramsHeartbeat = {
        taskToken: taskToken
    };
    stepfunctions.sendTaskHeartbeat(paramsHeartbeat, function(err, data) {
      if (err) {
          writeToLog(JSON.stringify(err));
          if (err.code == "TaskTimedOut"){
              removeHeartbeat(heartbeat, taskToken);
          }
      } else {
          //writeToLog(JSON.stringify(data));
          writeToLog('Heartbeat Sent: '+taskToken);
      }
  });
}

//Send each Heartbeat in array
function sendHeartbeat(){
    for (let i=0; i< heartbeat.length; i++) {
        //writeToLog(JSON.stringify(heartbeat[i]))
        heartbeatFunc(heartbeat[i]);
    }
}

//Loop for Heartbeat(s), send every 3 mins.  Activity heartbeat timeout = 5 min.
setInterval(function() {
    if(heartbeat.length > 0){
        sendHeartbeat();
        //Reset shutdown timer
        setTime();
    }
}, 180000);

//Get GovCloud Creds
function getParameter(value){
    return new Promise(resolve => {
        let params = {
              Name: value,
              WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
                reject(err);
            } else {
                //Resolve with Parameter Value
                resolve(data.Parameter.Value);
            }
        });
    });
}

//Stop Instance after 1 hour from last copy.  Also reset timer at start of copy.
setInterval(function() {
    now = Date.now();
    writeToLog(stopScriptTime+' Time at which to stop instance.');
    if (now > stopScriptTime){
        //Remove Connected, Orphaned Volumes before stopping instance
        orphanedVolumes();
        let instanceId = httpGet("http://169.254.169.254/latest/meta-data/instance-id");
        let ec2Params = {
            InstanceIds: [instanceId],
            Force: true
        };
        ec2.stopInstances(ec2Params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
            } else {
                writeToLog(JSON.stringify(data));
            }
        });
    }
}, 65000);

//Construct Activty ARN so we can find tasks
function createActivityArn() {
    return new Promise((resolve, reject) => {
        let callerParams = {
        };
        //Use STS to find the account number
        sts.getCallerIdentity(callerParams, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
                reject(err);
            } else {
                //Create Step Functions State Machine ARN
                let arn = 'arn:aws:states:'+region+':'+data.Account+':activity:ec2s3Copy';
                resolve(arn);
            }
        });
    });
}

//Find Tasks to copy
function findTask(activityArn) {
    return new Promise((resolve, reject) => {
        let params = {
            activityArn: activityArn,
        };
        stepfunctions.getActivityTask(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
            } else {
                if (isEmpty(data)){
                    reject(err);
                } else {
                		//Parse the results
                		let obj = JSON.parse(data.input);
                    obj.taskToken = data.taskToken;
                    writeToLog('***New Task***');
                    writeToLog(JSON.stringify(obj));
                		resolve(obj);
                }
            }
        });
    });
}

function sendTaskFailure(taskToken) {
    return new Promise((resolve, reject) => {
        let params = {
            taskToken: taskToken,
            cause: 'S3 Copy Failed'
        };
        stepfunctions.sendTaskFailure(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
            } else {
                writeToLog(JSON.stringify('Sent Task Failure to StepFunctions'));
                return(data);
            }
        });
    });
}

function sendTaskSuccess(taskToken) {
    return new Promise((resolve, reject) => {
        let params = {
            output: "true",
            taskToken: taskToken
        };
        stepfunctions.sendTaskSuccess(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
            } else {
                writeToLog(JSON.stringify('Sent Task Success to StepFunctions'));
                return(data);
            }
        });
    });
}

//Mount Buckets via s3fs shell script
function mountBucket(bucket){
    return new Promise((resolve, reject) => {
      console.log(bucket);
        exec('./shell/mountBucket.sh -b '+ bucket, (err, stdout, stderr) => {
          if (stdout.startsWith("success")) {
             writeToLog(stdout)
             resolve("success");
          } else {
             resolve('fail');
          }
        });
    });
}

//Unmount Buckets via s3fs shell script
function umountBucket(bucket){
    return new Promise((resolve, reject) => {
        exec('./shell/umountBucket.sh -b '+ bucket, (err, stdout, stderr) => {
          if (stdout.startsWith("success")) {
             resolve("success");
          } else {
             resolve('fail');
          }
        });
    });
}

//Construct S3 Sync Activty ARN
function createS3ActivityArn() {
    return new Promise((resolve, reject) => {
        let callerParams = {
        };
        //Use STS to find the account number
        sts.getCallerIdentity(callerParams, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
                reject(err);
            } else {
                //Create Step Functions State Machine ARN
                let arn = 'arn:aws:states:'+region+':'+data.Account+':activity:s3s3Sync';
                resolve(arn);
            }
        });
    });
}

//Find S3 Sync Tasks
function findS3Task(s3activityArn) {
    return new Promise((resolve, reject) => {
        let params = {
            activityArn: s3activityArn,
        };
        stepfunctions.getActivityTask(params, function(err, data) {
            if (err) {
                writeToLog(JSON.stringify(err));
            } else {
                if (isEmpty(data)){
                    reject(err);
                } else {
                		//Parse the results
                		let obj = JSON.parse(data.input);
                    obj.taskToken = data.taskToken;
                    writeToLog('***New S3 Sync Task***');
                    writeToLog(JSON.stringify(obj));
                		resolve(obj);
                }
            }
        });
    });
}

//Copy connected volumne to GovCloud S3
function copyVolume(taskData){
    return new Promise((resolve, reject) => {
        //Set Object & Params for GovCloud S3 Upload
        let s3 = new AWS.S3({
            region: 'us-gov-west-1',
            accessKeyId: taskData.accessKeyId,
            secretAccessKey: taskData.secretAccessKey
        });
        // call S3 to retrieve upload file to specified bucket
        let uploadParams = {Bucket: taskData.s3Bucket, Key: taskData.volumeId, Body: ''};

        //Read Volume Mount point and set it as S3 boday
        let fileStream = fs.createReadStream(taskData.device);
        fileStream.on('error', function(err) {
            writeToLog(JSON.stringify(err));
        });
        uploadParams.Body = fileStream;
        //Set S3 Upload Options
        let options = {partSize: 10 * 1024 * 1024, queueSize: 4};
        //call S3 to upload
        s3.upload(uploadParams, options, function (err, data){
            if (err) {
                removeHeartbeat(heartbeat, taskData.taskToken);
                //Send a failure to Step Functions
                sendTaskFailure(taskData.taskToken);
                writeToLog(JSON.stringify(err));
                removeVolume(taskData.volumeId);
                reject(err);
            } if (data) {
                removeHeartbeat(heartbeat, taskData.taskToken);
                writeToLog(JSON.stringify(data));
                resolve(data);
            }
        }).on('httpUploadProgress', function(evt) {
            msg = taskData.volumeId+' Progress: '+formatBytes(evt.loaded)
            writeToLog2(msg, "imageProgressLog");
        });
    });
}

//Flow Control in order
async function copyImage() {
    try {
        let activityArn = await createActivityArn();
        //findTask promise rejects when no tasks are present
        let taskData = await findTask(activityArn);
        taskData.device = await findLetter(taskData.volumeId);
        await attachVolume(taskData, instanceId);
        //Give the Volume a chance to mount
        await timeout(10000)
        //Get GovCloud Creds from Commercial SSM
        taskData.s3Bucket = await getParameter('gov-cloud-import-s3Bucket');
        taskData.accessKeyId = await getParameter('gov-cloud-import-accessKey');
        taskData.secretAccessKey = await getParameter('gov-cloud-import-secretKey');
        //Add to heartbeat array
        heartbeat.push(taskData.taskToken);
        //Copy the Volume to GovCloud S3

        await copyVolume(taskData);
        //Reset shutdown timer
        setTime();
        sendTaskSuccess(taskData.taskToken);
        removeVolume(taskData.volumeId);
    } catch(err){
        if (err){
          writeToLog(err);
        } else {
          writeToLog('No New Image Import Tasks');
        }
    }
};

//Start Image Import Script
copyImage();
//Start new poll every 65 seconds, AWS Task long poll is 60 second timeout.
setInterval(function() {
    copyImage();
}, 65000);

async function syncS3(){
    try {
        let activityArn = await createS3ActivityArn();
        let taskData = await findS3Task(activityArn);
        let mounted = await mountBucket(taskData.sourceBucket);
        if (mounted == "success"){
            taskData.accessKeyId = await getParameter('gov-cloud-import-accessKey');
            taskData.secretAccessKey = await getParameter('gov-cloud-import-secretKey');
            //Create S3 client object
            let client = s3.createClient({
              maxAsyncS3: 20,     // this is the default
              s3RetryCount: 3,    // this is the default
              s3RetryDelay: 1000, // this is the default
              multipartUploadThreshold: 20971520, // this is the default (20 MB)
              multipartUploadSize: 15728640, // this is the default (15 MB)
              s3Options: {
                accessKeyId: taskData.accessKeyId,
                secretAccessKey: taskData.secretAccessKey,
                region:"us-gov-west-1"
              },
            });

            let params = {
              localDir: "/home/ec2-user/s3fs/" + taskData.sourceBucket,
              deleteRemoved: true,
              s3Params: {
                Bucket: taskData.destBucket,
              },
            };
            //Start Sync
            let uploader = client.uploadDir(params);
            //Create Heartbeat
            heartbeat.push(taskData.taskToken);
            //EventEmitters
            uploader.on('error', function(err) {
                writeToLog("unable to sync: "+err);
                umountBucket(taskData.sourceBucket);
                sendTaskFailure(taskData.taskToken);
            });
            uploader.on('progress', function() {
                let msg = "S3 Sync Progress: "+formatBytes(uploader.progressAmount)+" of "+formatBytes(uploader.progressTotal)
                writeToLog2(msg, "syncProgressLog");
            });
            uploader.on('fileUploadStart', function(localFilePath, s3Key) {
                let filePath = localFilePath.replace("/home/ec2-user/s3fs/", "");
                let msg = "Started copying From: s3://"+filePath+" To: s3://"+taskData.destBucket+'/'+s3Key
                writeToLog2(msg, "s3SyncLog");
            });
            uploader.on('fileUploadEnd', function(localFilePath, s3Key) {
                let filePath = localFilePath.replace("/home/ec2-user/s3fs/", "");
                let msg = "Finished copying From: s3://"+filePath+" To: s3://"+taskData.destBucket+'/'+s3Key
                writeToLog2(msg, "s3SyncLog");
            });
            uploader.on('end', function() {
                let msg = "Destination: "+ taskData.destBucket +" has been synchronized with Source: "+ taskData.sourceBucket
                writeToLog(msg);
                sendTaskSuccess(taskData.taskToken);
                removeHeartbeat(heartbeat, taskData.taskToken);
                umountBucket(taskData.sourceBucket);
            });
        } else {
          writeToLog("S3FS Commercial S3 Bucket failed to mount")
        }
    } catch(err){
        if (err){
          writeToLog(err);
        } else {
          writeToLog('No New S3 Sync Tasks');
        }
    }
}

//Start S3 Sync Script
syncS3();
//Start new poll every 65 seconds, AWS Task long poll is 60 second timeout.
setInterval(function() {
    syncS3();
}, 65000);
