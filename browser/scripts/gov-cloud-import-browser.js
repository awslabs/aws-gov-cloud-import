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

//Test if object is empty
function isEmpty(obj) {
    for(let key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

//Find gov-cloud-import-ec2 and Terminate
function terminateInst(ec2){
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
                resolve(err, err.stack);
            } else {
                if (isEmpty(data.Reservations[0])) {
                    resolve("No Instances")
                } else {
                    let instanceId = data.Reservations[0].Instances[0].InstanceId
                    let ec2Params = { InstanceIds: [instanceId] };
                    ec2.terminateInstances(ec2Params, function(err, data) {
                        if (err) {
                            console.log(JSON.stringify(err));
                        } else {
                            console.log(JSON.stringify(data));
                        }
                    });
                }
            }
        });
    });
}

//Cloudformation Deployment in Commercial
function removeCommercial(cloudformation){
    return new Promise((resolve, reject) => {
        let params = { StackName: 'gov-cloud-import'};
        cloudformation.deleteStack(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
                refreshInstallStatus();
            }
        });
    });
}

//Cloudformation Deployment in GovCloud
function removeGovCloud(cloudformation){
    return new Promise((resolve, reject) => {
        let params = { StackName: 'gov-cloud-import'};
        cloudformation.deleteStack(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
                refreshInstallStatus();
            }
        });
    });
}

function deleteParameters(ssm){
    return new Promise((resolve, reject) => {
        let params = {
            Names: [
                'gov-cloud-import-s3Bucket',
                'gov-cloud-import-secretKey',
                'gov-cloud-import-accessKey',
                'gov-cloud-import-ec2-'+region
            ]
        };
        ssm.deleteParameters(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function deleteKeyPair(ec2, region){
    return new Promise((resolve, reject) => {
        let params = { KeyName: "gov-cloud-import-ec2-"+region };
        ec2.deleteKeyPair(params, function(err, data) {
            if (err) {
                console.log(err)
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function getS3Bucket(ssm){
    return new Promise((resolve, reject) => {
        let params = {
              Name: "gov-cloud-import-s3Bucket",
              WithDecryption: true
        };
        ssm.getParameter(params, function(err, data) {
            if (err) {
                if (err.code == 'ParameterNotFound'){
                   resolve()
                }
                reject(err);
            } else {
                //Resolve with Parameter Value
                resolve(data.Parameter.Value);
            }
        });
    });
}

//Get S3 Bucket Objects
function gets3Objects(s3Bucket, s3){
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: s3Bucket
        };
        s3.listObjects(params, function(err, data) {
            if (err) {
                if (err.code == "NoSuchBucket"){
                  resolve('')
                }
                reject(err);
            } else {
                let length = data.Contents.length;
                let s3Objects = [];
                for (let index = 0; index < length; ++index) {
                    s3Objects[index] = { Key : data.Contents[index].Key };
                }
                //Resolve with Parameter Value
                resolve(s3Objects);
            }
        });
    });
}

//Remove S3 Bucket Objects
function deleteAllS3Objects(s3Bucket, s3Objects){
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: s3Bucket,
            Delete: {
                Objects: s3Objects
           }
        };
        s3.deleteObjects(params, function(err, data) {
            if (err) {
                if (isEmpty(s3Objects)){
                    resolve("Bucket Empty")
                } else {
                    reject(err);
                }

            } else {
                resolve(data);
            }
        });
    });
}

//Watch CloudFormation Status until Complete
function watchComCloudFormation(refreshIdCom, cloudformation, config){
    return new Promise((resolve, reject) => {
        let date = new Date();
        let params = {
            StackName: 'gov-cloud-import'
        };
        cloudformation.describeStacks(params, function(err, data) {
            if (err) {
                resolve(err);
            } else {
                if (data.Stacks[0].StackStatus == "DELETE_COMPLETE") {
                    refreshInstallStatus();
                    clearInterval(refreshIdCom);
                } else if (data.Stacks[0].StackStatus = "DELETE_FAILED"){
                    refreshInstallStatus();
                    clearInterval(refreshIdCom);
                } else if (data.Stacks[0].StackStatus = "CREATE_COMPLETE"){
                    refreshInstallStatus();
                    clearInterval(refreshIdCom);
                }
                resolve(data.Stacks[0].StackStatus);
            }
        });
    });
}

//Watch CloudFormation Status until Complete
function watchGovCloudFormation(refreshIdGov, govCloudFormation, config){
    return new Promise((resolve, reject) => {
        let date = new Date();
        let params = {
            StackName: 'gov-cloud-import'
        };
        govCloudFormation.describeStacks(params, function(err, data) {
            if (err) {
                resolve(err.message);
            } else {
                if (data.Stacks[0].StackStatus == "DELETE_COMPLETE") {
                    refreshInstallStatus();
                    clearInterval(refreshIdGov);
                } else if (data.Stacks[0].StackStatus = "DELETE_FAILED"){
                    refreshInstallStatus();
                    clearInterval(refreshIdGov);
                } else if (data.Stacks[0].StackStatus = "CREATE_COMPLETE"){
                    refreshInstallStatus();
                    clearInterval(refreshIdGov);
                }
                resolve(data.Stacks[0].StackStatus)
            }
        });
    });
}

//Find Status function
function findLambdaFunction(lambda, lambdaName){
    return new Promise((resolve, reject) => {
        //Params for Lambda invoke
        let params = {};
        // Call the Lambda function
        lambda.listFunctions(params, function(err, data) {
            if (err) {
                resolve(err.message);
            } else {
                let length = data.Functions.length;
                for (let index = 0; index < length; ++index) {
                    let str = data.Functions[index].FunctionName;
                    if(str.startsWith("gov-cloud-import-"+lambdaName)){
                        resolve(str);
                    }
                }
                resolve("Not Installed");
            }
        });
    });
}

//Kick off step functions
function initStepFunction(lambda, name){
    return new Promise((resolve, reject) => {
        let image = document.getElementById("image").value;
        let os = document.getElementById("os").value;
        let region = document.getElementById("region").value;
        //Params for Lambda invoke
        let params = {
            FunctionName : name,
            InvocationType : 'RequestResponse',
            LogType : 'Tail',
            Payload : JSON.stringify({"image": image, "region": region, "os": os})
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                document.getElementById("execArn").innerHTML = err;
            } else {
                let region = lambda.config.region
                let arn = JSON.parse(data.Payload)
                let link = 'https://console.aws.amazon.com/states/home?region='+region+'#/executions/details/'+arn.executionArn;
                document.getElementById("execArn").innerHTML += '<a href="'+link+'" target="_blank">'+arn.executionArn+'</a> <br>';
                resolve(data);
            }
        });
    });
}

//Kick off S3 Sync step functions
function initS3StepFunction(lambda, name){
    return new Promise((resolve, reject) => {
        let comBucket = document.getElementById("comBucket").value;
        let govBucket = document.getElementById("govBucket").value;
        //Params for Lambda invoke
        let params = {
            FunctionName : name,
            InvocationType : 'RequestResponse',
            LogType : 'Tail',
            Payload : JSON.stringify({"source": comBucket, "dest": govBucket})
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                document.getElementById("execArnS3").innerHTML = err;
            } else {
                let region = lambda.config.region
                let arn = JSON.parse(data.Payload)
                let link = 'https://console.aws.amazon.com/states/home?region='+region+'#/executions/details/'+arn.executionArn;
                document.getElementById("execArnS3").innerHTML += '<a href="'+link+'" target="_blank">'+arn.executionArn+'</a> <br>';
                resolve(data);
            }
        });
    });
}

//Kick off appStatus
function initAppStatus(lambda, name){
    return new Promise((resolve, reject) => {
        //Params for Lambda invoke
        let params = {
            FunctionName : name,
            InvocationType : 'RequestResponse',
            LogType : 'Tail'
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                if (err.code == 'ResourceNotFoundException'){
                  console.log(err)
                  resolve('Not Installed');
                }
                console.log(err.message);
                resolve(err.message)
            } else {
                resolve(data.Payload);
            }
        });
    });
}

//Kick off SNS Subscribe
function initSNSSubscribe(lambda, name){
    return new Promise((resolve, reject) => {
        let snsProtocol = document.getElementById("snsProtocol").value;
        let snsTopic = document.getElementById("snsTopic").value;
        let snsRegion = document.getElementById("snsRegion").value;
        let snsEndpoint = document.getElementById("snsEndpoint").value;

        //Params for Lambda invoke
        let params = {
            FunctionName : name,
            InvocationType : 'RequestResponse',
            LogType : 'Tail',
            Payload : JSON.stringify({
                "protocol": snsProtocol,
                "topic": snsTopic,
                "endpoint": snsEndpoint,
                "region": snsRegion
            })
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                console.log(err.message);
                resolve(err.message)
            } else {
                document.getElementById("snsSubscribe").innerHTML += data.Payload+'<br>';
                resolve(data.Payload);
            }
        });
    });
}

//Kick off appStatus
function initUninstall(lambda, uninstall){
    return new Promise((resolve, reject) => {
        //Params for Lambda invoke
        let params = {
            FunctionName : uninstall,
            InvocationType : 'RequestResponse',
            LogType : 'Tail'
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                console.log(err.message);
                resolve(err.message)
            } else {
                resolve(data.Payload);
            }
        });
    });
}

function getRegions(ec2){
    return new Promise((resolve, reject) => {
        let params = {};
        ec2.describeRegions(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                let length = data.Regions.length;
                let regionList = [];
                for (let index = 0; index < length; ++index) {
                    regionList[index] = data.Regions[index].RegionName
                }
                resolve(regionList);

            }
        });
    });
}

//Kick off step functions
function getBuckets(lambda, listBuckets){
    return new Promise((resolve, reject) => {
        //Params for Lambda invoke
        let params = {
            FunctionName : listBuckets,
            InvocationType : 'RequestResponse',
            LogType : 'Tail'
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data.Payload);
            }
        });
    });
}

//Update Select Dropdowns
function setSelect(array, docId){
    return new Promise((resolve, reject) => {
        //Clear the current options, leave Select.
        let select = document.getElementById(docId);
        select.options.length = 1;
        /*let option = document.createElement("option");
        option.text = "Select";
        select.add(option);*/

        //Replace them with current
        let length = array.length;
        for (let index = 0; index < length; ++index) {
            let c = document.createElement("option");
            c.text = array[index];
            select.options.add(c);
        }
        document.getElementById(docId).selectedIndex = 0;

    });
}

function setRegionAndKeys(){
    return new Promise((resolve, reject) => {
        let config = {};
        //Find GovCloud Region then find adjacent Region
        config.govRegion = 'us-gov-west-1'//document.getElementById("govRegion").value;
        if (config.govRegion == 'us-gov-west-1') {
            config.comRegion = 'us-west-2';
        } else if (config.govRegion == 'us-gov-east-1'){
            config.govRegion = 'us-west-2';//Until GovCloud East its made
        }
        //API Keys from the form
        config.comAccess = document.getElementById("comAccess").value;
        config.comSecret = document.getElementById("comSecret").value;
        config.govRemoveAccess = document.getElementById("govRemoveAccess").value;
        config.govRemoveSecret = document.getElementById("govRemoveSecret").value;
        config.comRemoveAccess = document.getElementById("comRemoveAccess").value;
        config.comRemoveSecret = document.getElementById("comRemoveSecret").value;
        resolve(config);
    });
}
function validateEc2Describe(ec2){
    return new Promise((resolve, reject) => {
        let params = {};
        ec2.describeRegions(params, function(err, data) {
          if (err) resolve("Failed");
          else     resolve("Success");
        });
    });
}

function validateLmabdaList(lambda){
    return new Promise((resolve, reject) => {
        let params = {};
        lambda.listFunctions(params, function(err, data) {
          if (err) resolve("Failed");
          else     resolve("Success");
        });
    });
}
function validateLmabdaInvoke(lambda){
    return new Promise((resolve, reject) => {
        let params = {};
        lambda.listFunctions(params, function(err, data) {
          if (err) {
              resolve("Failed");
          } else {
            let params = {
              FunctionName: data.Functions[0].FunctionName,
              InvocationType: 'DryRun'
            };
            lambda.invoke(params, function(err, data) {
              if (err) resolve("Failed");
              else     resolve("Success");
            });
          }
        });
    });
}

//Validate Image Input field
function validateImageFormat(){
    let image = document.getElementById("image").value;
    //Regex for ami/snap formatting
    if (/^ami\-[a-f0-9]{8}$|snap\-[a-f0-9]{17}$/.test(image)){
      console.log("valid image input")
    } else {
       $.mobile.changePage( "#noverify", { role: "dialog" } );
       document.getElementById("image").value = "";
    }
}

//Validate SNS Input field
function validateSNSFormat(){
    let endpoint = document.getElementById("snsEndpoint").value;
    //Regex for ami/snap formatting
    if (/^[1](\(\d{3}\)[.-]?|\d{3}[.-]?)?\d{3}[.-]?\d{4}$|^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(endpoint)){
      //console.log("valid input")
    } else {
       $.mobile.changePage( "#noverifySNS", { role: "dialog" } );
       document.getElementById("snsEndpoint").value = "";
    }
}

//Make user go to API Page if they're on a page & don't have keys filled
function validateKey(){
    //API Keys from the form
    comAccess = document.getElementById("comAccess").value;
    comSecret = document.getElementById("comSecret").value;
    if (comAccess && comSecret) {
        //console.log("Keys Filled Out")
    } else {
        $.mobile.changePage( "#verify", { role: "dialog" } );
    }
}

//Show User Import Image Params before Submitting
function showImageParams(){
    $.mobile.changePage( "#verifyImageParams", { role: "dialog" } );
    document.getElementById("verifyImageInput").innerHTML = document.getElementById("image").value;
    document.getElementById("verifyOSInput").innerHTML = document.getElementById("os").value;
    document.getElementById("verifySourceRegionInput").innerHTML = document.getElementById("region").value;
    document.getElementById("verifyDestRegionInput").innerHTML = document.getElementById("govRegion").value;
}

//Show User Import Image Params before Submitting
function showS3Params(){
    $.mobile.changePage( "#verifyS3Params", { role: "dialog" } );
    document.getElementById("verifySourceS3").innerHTML = document.getElementById("comBucket").value;
    document.getElementById("verifyDestS3").innerHTML = document.getElementById("govBucket").value;
}

//Combine Async Functions to get status in both regions
function refreshInstallStatus(){
    refreshInstallStatusWest();
    refreshInstallStatusEast();
}

//Jquery Function for loading Scripts when Pages load
$(document).on('pagecontainershow', function (e, ui) {
    let activePage = $(':mobile-pagecontainer').pagecontainer('getActivePage').attr('id');
    if(activePage === 'uninstall') {
        //Refresh Status on Page Load
        refreshInstallStatus();
        validateKey();
    } else if(activePage === 'import') {
        validateKey();
        //Get Region List
        setRegionList();
    } else if(activePage === 's3sync') {
        //Make sure S3 Bucket selection is reset
        document.getElementById("govBucket").selectedIndex = 0;
        document.getElementById("comBucket").selectedIndex = 0;
        validateKey();
        //Get Bucket Lists
        setGovCloudBucketsForSync();
        setComBucketsForSync();
    } else if(activePage === 'home') {
        $('#panel').panel("open");
    } else if(activePage === 'notify') {
        validateKey();
    }
});

function setS3LogURL(region){
    let link = 'https://console.aws.amazon.com/cloudwatch/home?region='+region+'#logEventViewer:group=/gov-cloud-import/s3Synclog';
    console.log(link);
    document.getElementById("s3SyncLog").innerHTML = '<a href="'+link+'" target="_blank">S3 Sync Logs</a> <br>';
}

async function initWorkflow() {
    //Browse back from verify dialog
    window.history.back();
    //Reset Options
    //document.getElementById('region').value=Select;
    //document.getElementById('os').value=Select;
    //document.getElementById('govRegion').value=Select;
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Volume ID, OS, & Source Region
    let initStep = await findLambdaFunction(lambda, "initStepFunction");
    let initStepOutput = await initStepFunction(lambda, initStep);
}

async function initS3SyncWorkflow() {
    //Browse back from verify dialog
    window.history.back();
    //Reset Options
    //document.getElementById('comBucket').value=Select;
    //document.getElementById('govBucket').value=Select;
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Show Logging URL
    setS3LogURL(config.comRegion);
    //Volume ID, OS, & Source Region
    let initStep = await findLambdaFunction(lambda, "initS3Sync");
    let initStepOutput = await initS3StepFunction(lambda, initStep);
}

async function setGovCloudBucketsForSync(){
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Volume ID, OS, & Source Region
    let listBuckets = await findLambdaFunction(lambda, "listGovBuckets");
    let destBuckets = await getBuckets(lambda, listBuckets);
    //update select Menu
    setSelect(JSON.parse(destBuckets), "govBucket")
    //Reset the select option
    document.getElementById("govBucket").selectedIndex = 0;
}

async function setComBucketsForSync(){
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Volume ID, OS, & Source Region
    let listBuckets = await findLambdaFunction(lambda, "listComBuckets");
    let destBuckets = await getBuckets(lambda, listBuckets);
    //update select Menu
    setSelect(JSON.parse(destBuckets), "comBucket")
    //Reset the select option
    document.getElementById("comBucket").selectedIndex = 0;
}

async function setRegionList(){
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let ec2 = new AWS.EC2({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Volume ID, OS, & Source Region
    let sourceRegions = await getRegions(ec2);
    //update select Menu
    setSelect(sourceRegions, "region")
}
/*
async function setComBucketsForSync(){
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Volume ID, OS, & Source Region
    let listBuckets = await findComS3lambda(lambda);
    let destBuckets = await getBuckets(lambda, listBuckets);
    //update select Menu
    setSelect(JSON.parse(destBuckets), "comBucket")
}
*/
async function refreshInstallStatusWest(){
    let config = await setRegionAndKeys();
    let lambda = new AWS.Lambda({
        region: 'us-west-2',
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Find Status of West
    let appStatus = await findLambdaFunction(lambda, "snsSubscribe");

    if (appStatus == 'Not Installed'){
        document.getElementById("comWestCFStatus").innerHTML = appStatus;
        document.getElementById("govWestCFStatus").innerHTML = appStatus;
    } else {
        let status = await initAppStatus(lambda, appStatus);
        status = JSON.parse(status);
        if (isEmpty(status[1])){
            //If we can't tell anything, show not installed
            document.getElementById("govWestCFStatus").innerHTML = "Not Installed";
            document.getElementById("govWestCFTime").innerHTML = "Not Installed";
        } else if (status[1].hasOwnProperty('status')){
            document.getElementById("westVersion").innerHTML = status[0].version;
            document.getElementById("govWestCFStatus").innerHTML = status[1].status;
            document.getElementById("govWestCFTime").innerHTML = status[1].create;
        } else if (status[1].hasOwnProperty('code')) {
            //Print Error
            document.getElementById("govWestCFStatus").innerHTML = status[1].code;
            document.getElementById("govWestCFTime").innerHTML = status[1].code;
        } else {
            //If we can't tell anything, show not installed
            document.getElementById("govWestCFStatus").innerHTML = "Not Installed";
            document.getElementById("govWestCFTime").innerHTML = "Not Installed";
        }
        if (isEmpty(status[2])){
            //If we can't tell anything, show not installed
            document.getElementById("comWestCFStatus").innerHTML = "Not Installed";
            document.getElementById("comWestCFTime").innerHTML = "Not Installed";
        } else if (status[2].hasOwnProperty('status')){
            document.getElementById("westVersion").innerHTML = status[0].version;
            document.getElementById("comWestCFStatus").innerHTML = status[2].status;
            document.getElementById("comWestCFTime").innerHTML = status[2].create;
        } else if (status[2].hasOwnProperty('code')) {
            //Print Error
            document.getElementById("comWestCFStatus").innerHTML = status[2].code;
            document.getElementById("comWestCFTime").innerHTML = status[2].code;
        } else {
            //If we can't tell anything, show not installed
            document.getElementById("comWestCFStatus").innerHTML = "Not Installed";
            document.getElementById("comWestCFTime").innerHTML = "Not Installed";
        }
    }
}

async function refreshInstallStatusEast(){
    let config = await setRegionAndKeys();
    let lambda = new AWS.Lambda({
        region: 'us-east-2',
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Find Status of East
    let appStatus = await findLambdaFunction(lambda, "appStatus");

    if (appStatus == 'Not Installed'){
        document.getElementById("comEastCFStatus").innerHTML = appStatus;
        document.getElementById("govEastCFStatus").innerHTML = appStatus;
    } else {
        let status = await initAppStatus(lambda, appStatus);
        status = JSON.parse(status);
        if (isEmpty(status[1])){
            //If we can't tell anything, show not installed
            document.getElementById("govEastCFStatus").innerHTML = "Not Installed";
            document.getElementById("govEastCFTime").innerHTML = "Not Installed";
        } else if (status[1].hasOwnProperty('status')){
            document.getElementById("EastVersion").innerHTML = status[0].version;
            document.getElementById("govEastCFStatus").innerHTML = status[1].status;
            document.getElementById("govEastCFTime").innerHTML = status[1].create;
        } else if (status[1].hasOwnProperty('code')) {
            //Print Error
            document.getElementById("govEastCFStatus").innerHTML = status[1].code;
            document.getElementById("govEastCFTime").innerHTML = status[1].code;
        } else {
            //If we can't tell anything, show not installed
            document.getElementById("govEastCFStatus").innerHTML = "Not Installed";
            document.getElementById("govEastCFTime").innerHTML = "Not Installed";
        }
        if (isEmpty(status[2])){
            //If we can't tell anything, show not installed
            document.getElementById("comEastCFStatus").innerHTML = "Not Installed";
            document.getElementById("comEastCFTime").innerHTML = "Not Installed";
        } else if (status[2].hasOwnProperty('status')){
            document.getElementById("EastVersion").innerHTML = status[0].version;
            document.getElementById("comEastCFStatus").innerHTML = status[2].status;
            document.getElementById("comEastCFTime").innerHTML = status[2].create;
        } else if (status[2].hasOwnProperty('code')) {
            //Print Error
            document.getElementById("comEastCFStatus").innerHTML = status[2].code;
            document.getElementById("comEastCFTime").innerHTML = status[2].code;
        } else {
            //If we can't tell anything, show not installed
            document.getElementById("comEastCFStatus").innerHTML = "Not Installed";
            document.getElementById("comEastCFTime").innerHTML = "Not Installed";
        }
    }
}

async function validateKeyPrivs(){
    //Bring the Dialog to focus
    $.mobile.changePage( "#verifyPrivs", { role: "dialog" } );
    let config = await setRegionAndKeys();
    //AWS Config/Objects
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    let ec2 = new AWS.EC2({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    //Test Each API Call we need
    let ec2Describe = await validateEc2Describe(ec2);
    let lambdaList = await validateLmabdaList(lambda)
    let lambdaInvoke = await validateLmabdaInvoke(lambda, lambdaList)
    //Print Success or Failed
    document.getElementById("ec2Describe").innerHTML = ec2Describe;
    document.getElementById("lambdaList").innerHTML = lambdaList;
    document.getElementById("lambdaInvoke").innerHTML = lambdaInvoke;
}

async function uninstallWest(){
    window.history.back();
    tearDownGov();
    tearDownCom();
    refreshInstallStatus();
}

async function subscribeTopic(){
    $.mobile.changePage( "#notifySubmit", { role: "dialog" } );
    document.getElementById("snsValidateProtocol").innerHTML = document.getElementById("snsProtocol").value;
    document.getElementById("snsValidateTopic").innerHTML = document.getElementById("snsTopic").value;
    document.getElementById("snsValidateRegion").innerHTML = document.getElementById("snsRegion").value;
    document.getElementById("snsValidateEndpoint").innerHTML = document.getElementById("snsEndpoint").value;
    let config = await setRegionAndKeys();
    let lambda = new AWS.Lambda({
        region: config.comRegion,
        accessKeyId: config.comAccess,
        secretAccessKey: config.comSecret
    });
    let name = await findLambdaFunction(lambda, "snsSubscribe");
    let some = await initSNSSubscribe(lambda, name);

}

//Tear down Commercial West
async function tearDownCom(){
    let config = await setRegionAndKeys();
    let ec2 = new AWS.EC2({
        region: config.comRegion,
        accessKeyId: config.comRemoveAccess,
        secretAccessKey: config.comRemoveSecret
    });
    let cloudformation = new AWS.CloudFormation({
        region: config.comRegion,
        accessKeyId: config.comRemoveAccess,
        secretAccessKey: config.comRemoveSecret
    });
    await terminateInst(ec2);
    await removeCommercial(cloudformation);
    deleteKeyPair(ec2, config.comRegion);
}

//Tear down GovCloud West
async function tearDownGov(){
    let config = await setRegionAndKeys();
    let ssm = new AWS.SSM({
        region: config.comRegion,
        accessKeyId: config.comRemoveAccess,
        secretAccessKey: config.comRemoveSecret
    });
    let cloudformation = new AWS.CloudFormation({
        region: config.govRegion,
        accessKeyId: config.govRemoveAccess,
        secretAccessKey: config.govRemoveSecret
    });

    deleteParameters(ssm, config.comRegion);
    //let s3Bucket = await getS3Bucket(ssm);
    /*if (s3Bucket !== null ){
        let s3 = new AWS.S3({accessKeyId: govAccess, secretAccessKey: govSecret});
        let s3Objects = await gets3Objects(s3Bucket, s3);
        if (s3Objects.length > 0 ){
            await deleteAllS3Objects(s3Bucket, s3Objects);
        }
    }*/
    removeGovCloud(cloudformation);
    let refreshIdGov = setInterval(function() {
        let statusGov = watchGovCloudFormation(refreshIdGov, cloudformation, config);
    }, 10000);
}
