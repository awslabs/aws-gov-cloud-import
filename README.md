# GovCloud Import Tool
AWS has multiple Identity partitions;  AWS, AWS GovCloud (US), and AWS China. You can see these represented in their ARNs. Respectively; arn:aws, arn:aws-us-gov, arn:aws-cn. For security, services like Amazon Simple Storage Service (Amazon S3) do not have access to credentials beyond their boundary, which can make it difficult to transfer information from inside one Identity boundary to another.
<br><br>
With the tool GovCloud Import Tool, you have a web-based UI that allows you to import an AMI or Snapshot ID from Commercial to GovCloud (up to 100GiB). Within the same tool you can input of a Commercial S3 bucket and a GovCloud Destination Bucket and perform one way synchronizations(up to 1TiB).
![Overview Diagram](https://github.com/awslabs/aws-gov-cloud-import/raw/master/browser/images/diagramOverview.png)
 
<hr>

## Installation
The installation script deploys two CloudFormation Templates, one in Commercial and one in GovCloud.  In GovCloud, an S3 Bucket(for Importing Images only) and IAM resources to make the necessary API Calls for importing.  In Commercial, we deploy Step Functions, EC2, Lambda, SSM, S3, and SNS.  Step Functions will control the workflow as well as show progress.  EC2 Worker is used for the actual transfer of images or synchronization of buckets.  Lambda is used for calling all other functions in the workflow.  SSM parameter store securely keeps sensitive keys and other parameters necessary the overall application. S3 houses the user interface to gov-cloud-import.  SNS is used for notification at the end of an import.

Prior to install, please remove vmimport role from GovCloud if currently created.  Script should be able to install on any BASH shell(tested on MacOS and Amzn Linux).  You'll need API Keys with admin privileges for Commercial and GovCloud.  Installation takes a few minutes and will give progress during that time.  When finished, it will give you a URL to access the Web UI.  Please see sample install below.
Please note the errors.  These are from checking if cloudformation stack exists.  If they don't exist, the AWS CLI doesn't allow to suppress the errors.
```
git clone https://github.com/awslabs/aws-gov-cloud-import.git
cd aws-gov-cloud-import
chmod +x gov-cloud-import-install.sh
./gov-cloud-import-install.sh
```
![Install](https://github.com/awslabs/aws-gov-cloud-import/raw/master/browser/images/gov-cloud-import-install.gif)
<hr>

## Usage gov-cloud-import-image
Browse to the URL output by the installation script.  You need keys that allow for lambda-invoke, lambda-list, and e2-describeRegions.  Browse to the API Key page, enter keys, and click validate.  Then click notifications if you like to add your email or phone(sms) alerts.

For importing images, input an AMI or Snapshot ID.  The AMI or Snapshot must be owned by the account.  While the input field checks the format of the string, it does not check permissions.  Select the OS and Source/Destination Regions. Verify your input with a dialog box and import. You'll receive a State Machine Execution ARN to the import job.  Click to open in a new tab and watch process.

![Import Image](https://github.com/awslabs/aws-gov-cloud-import/raw/master/browser/images/ImageImportFinal.gif)
<hr>

## Usage gov-cloud-import-s3
For importing s3 buckets, you must give gov-cloud-import permissions to the source and destination bucket.  Please download the sample policy and modify to your needs.  Then click the link for Permissions and install your policy inline to the gov-cloud-import-ec2role.  Then click on the 2nd link for permissions and install your 2nd inline policy for user gov-cloud-import-user.

Once permissions are set, proceed to the Import S3 page.  From first the drop down menu, select your source.  From the second drop down menu, select your destination.  Verify your input and submit.

![Import S3](https://github.com/awslabs/aws-gov-cloud-import/raw/master/browser/images/ImportS3Final.gif)
<hr>

## Usage gov-cloud-import and AWS SDK
If you like to build gov-cloud-import into your application, here are sample calls in Javascript that can be used with AWS SDK to start an import.  Be sure to find the correct FunctionName as cloudformation suffixes randoms characters.  These can be sent to us-west-2 or us-east-2 depending on which GovCloud Region (and adjacent Commercial Region) you have installed and will import images.

For importing Images:
```
function initImportImage(lambda){
    return new Promise((resolve, reject) => {
        let image = 'ami-1234abcd' /*AMI or Snapshot ID*/
        let os = 'Windows'/*Windows or Linux*/
        let region = 'us-east-1'/*Source Commercial Region */
        //Params for Lambda invoke
        let params = {
            FunctionName : initStepFunction,
            InvocationType : 'RequestResponse',
            LogType : 'Tail',
            Payload : JSON.stringify({"image": image, "region": region, "os": os})
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
```

For Importing from S3:
```
function initS3Import(lambda){
    return new Promise((resolve, reject) => {
        let comBucket = 'my-commercial-bucket' /*Source Commercial Bucket*/
        let govBucket = 'my-govcloud-bucket' /*Destination GovCloud Bucket*/
        //Params for Lambda invoke
        let params = {
            FunctionName : initS3Sync,
            InvocationType : 'RequestResponse',
            LogType : 'Tail',
            Payload : JSON.stringify({"source": comBucket, "dest": govBucket})
        };
        // Call the Lambda function
        lambda.invoke(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
```

For HTTPS Success/Failed Callbacks:
```
function initSNSSubscribe(lambda){
    return new Promise((resolve, reject) => {
        let snsProtocol = 'https',
        let snsTopic = '<gov-cloud-import-image or gov-cloud-import-s3>';
        let snsRegion = '<us-west-2 or us-east-2>';;
        let snsEndpoint = 'https://my.application.com/some/ping/back';
        //Params for Lambda invoke
        let params = {
            FunctionName : snsSubscribe,
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
                reject(err)
            } else {
                resolve(data);
            }
        });
    });
}
```

Success or Failure notifications for Images:
```
{
  "sourceRegion": "us-west-2",
  "source": "ami-0123abdc",
  "destRegion": "us-gov-west-1",
  "dest": "ami-wxyz9876" 
} 

{
  "sourceRegion": "us-west-2",
  "source": "ami-0123abdc",
  "destRegion": "us-gov-west-1",
  "dest": "failed" 
}

```

Success or Failure notifications for S3:
```
{
  "sourceRegion": "us-west-2",
  "source": "my-aws-bucket",
  "destRegion": "us-gov-west-1",
  "dest": "my-govcloud-bucket" 
} 

{
  "sourceRegion": "us-west-2",
  "source": "my-aws-bucket",
  "destRegion": "us-gov-west-1",
  "dest": "failed" 
}

```
## Scheduling S3 Synchronization
With the use of scheduled CloudWatch events rules, you can trigger the initStepFuntion Lambda based on whatever schedule you need.  Take note, you want to make sure your schedule interval is greater than the time it takes to synchronize the bucket.  While it can run in parallel, it will decrease performance. Below shows an example input.

```
{"sourceBucket":"source-bucket", "destBucket":"destination bucket"}
```

![CloudWatch](https://github.com/awslabs/aws-gov-cloud-import/raw/master/browser/images/cloudwatchSchedule.png)
