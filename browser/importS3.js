function initS3StepFunction(lambda){
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
