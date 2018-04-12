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
