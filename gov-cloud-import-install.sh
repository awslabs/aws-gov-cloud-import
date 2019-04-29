#!/bin/bash

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
clear
cat << "EOF"
                            _                 _       _                            _
  __ _  _____   __      ___| | ___  _   _  __| |     (_)_ __ ___  _ __   ___  _ __| |_
 / _` |/ _ \ \ / /____ / __| |/ _ \| | | |/ _` |_____| | '_ ` _ \| '_ \ / _ \| '__| __|
| (_| | (_) \ V /_____| (__| | (_) | |_| | (_| |_____| | | | | | | |_) | (_) | |  | |_
 \__, |\___/ \_/       \___|_|\___/ \__,_|\__,_|     |_|_| |_| |_| .__/ \___/|_|   \__|
 |___/                                                           |_|

Written by awsjason
Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not
use this file except in compliance with the License.
EOF
AWS=$(command -v aws)
if [ -e $AWS ]; then
  echo ""
  echo "aws cli installed at $AWS"
else
  echo ""
  echo "aws cli doesn't seem to be installed.  Please verify before proceeding."
  echo ""
  exit
fi

echo ""
echo "Control-C to exit"
echo ""
echo "Please Enter **Admin** API Keys for Install:"
echo ""
read -p "Admin AWS GovCloud (US) Access Key: " GOV_ACCESS_KEY
read -p "Admin AWS GovCloud (US) Secret Key: " GOV_SECRET_KEY
read -p "Admin AWS Access Key: " COM_ACCESS_KEY
read -p "Admin AWS Secret Key: " COM_SECRET_KEY
clear
cat << "EOF"
                            _                 _       _                            _
  __ _  _____   __      ___| | ___  _   _  __| |     (_)_ __ ___  _ __   ___  _ __| |_
 / _` |/ _ \ \ / /____ / __| |/ _ \| | | |/ _` |_____| | '_ ` _ \| '_ \ / _ \| '__| __|
| (_| | (_) \ V /_____| (__| | (_) | |_| | (_| |_____| | | | | | | |_) | (_) | |  | |_
 \__, |\___/ \_/       \___|_|\___/ \__,_|\__,_|     |_|_| |_| |_| .__/ \___/|_|   \__|
 |___/                                                           |_|

Written by awsjason
Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not
use this file except in compliance with the License.
EOF
echo ""
while :
  do
    echo "Which Region?"
    echo " 1. West"
    echo " 2. East"
    echo -n "Please enter a selection: "
    read OPT
    case $OPT in
      1) COM_REGION="us-west-2"
         GOV_REGION="us-gov-west-1"
         CARD_DIR="west"
         break;;

      2) COM_REGION="us-east-2";
         GOV_REGION="us-gov-east-1"
         CARD_DIR="east"
         break;;

      *) echo "$OPT is an invaild option.";
         echo "Press [enter] to continue..."
         read enterKey;;
     esac
  done
echo ""
while :
  do
    echo "Does $COM_REGION have the limits for another VPC? Please Verify."
    echo " 1. Yes"
    echo " 2. No"
    echo -n "Please enter a selection: "
    read OPT
    case $OPT in
      1) echo ""
         echo "Proceeding..."
         break;;

      2) echo ""
         echo "Please fix before proceeding"
         exit;;

      *) echo "$OPT is an invaild option.";
         echo "Press [enter] to continue..."
         read enterKey;;
     esac
  done

#Set the creds
aws configure set aws_access_key_id $GOV_ACCESS_KEY --profile gov12345
aws configure set aws_secret_access_key $GOV_SECRET_KEY --profile gov12345
aws configure set region $GOV_REGION --profile gov12345
aws configure set output text --profile gov12345

aws configure set aws_access_key_id $COM_ACCESS_KEY --profile com12345
aws configure set aws_secret_access_key $COM_SECRET_KEY --profile com12345
aws configure set region $COM_REGION --profile com12345
aws configure set output text --profile com12345
clear
cat << "EOF"
                            _                 _       _                            _
  __ _  _____   __      ___| | ___  _   _  __| |     (_)_ __ ___  _ __   ___  _ __| |_
 / _` |/ _ \ \ / /____ / __| |/ _ \| | | |/ _` |_____| | '_ ` _ \| '_ \ / _ \| '__| __|
| (_| | (_) \ V /_____| (__| | (_) | |_| | (_| |_____| | | | | | | |_) | (_) | |  | |_
 \__, |\___/ \_/       \___|_|\___/ \__,_|\__,_|     |_|_| |_| |_| .__/ \___/|_|   \__|
 |___/                                                           |_|

Written by awsjason
Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not
use this file except in compliance with the License.
EOF
echo ""
echo "Thank you. Checking for Previous Installations elements."
echo ""
echo ""
COM_STATUS=$(aws cloudformation describe-stacks --stack-name gov-cloud-import --profile com12345 2> null | awk 'NF>1{print $NF}' | head -n 1)
GOV_STATUS=$(aws cloudformation describe-stacks --stack-name gov-cloud-import --profile gov12345 2> null | awk 'NF>1{print $NF}' | head -n 1)
ROLE_STATUS=$(aws iam get-role --role-name vmimport --profile gov12345 2> null | awk '/vmie.amazonaws.com/ {print $2}')

if [ "$GOV_STATUS" != "" ] || [ "$COM_STATUS" != "" ]; then
  if [[ -z ${GOV_STATUS} ]]; then
      GOV_STATUS="Does not exist"
  fi
  if [[ -z ${COM_STATUS} ]]; then
      COM_STATUS="Does not exist"
  fi
  if [[ -z ${ROLE_STATUS} ]]; then
      ROLE_STATUS="Does not exist"
  fi
  echo ""
  echo "Previous Cloudformation detected:"
  echo ""
  echo "$GOV_REGION status: $GOV_STATUS"
  echo "$COM_REGION status: $COM_STATUS"
  echo "VMImport Role status: $ROLE_STATUS"
  exit
else
  echo ""
  echo "No Cloudformation detected in $GOV_REGION or $COM_REGION."
  echo "VMImport Role status: $ROLE_STATUS"
  sleep 5
fi

clear
cat << "EOF"
                            _                 _       _                            _
  __ _  _____   __      ___| | ___  _   _  __| |     (_)_ __ ___  _ __   ___  _ __| |_
 / _` |/ _ \ \ / /____ / __| |/ _ \| | | |/ _` |_____| | '_ ` _ \| '_ \ / _ \| '__| __|
| (_| | (_) \ V /_____| (__| | (_) | |_| | (_| |_____| | | | | | | |_) | (_) | |  | |_
 \__, |\___/ \_/       \___|_|\___/ \__,_|\__,_|     |_|_| |_| |_| .__/ \___/|_|   \__|
 |___/                                                           |_|

Written by awsjason
Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not
use this file except in compliance with the License.
EOF
echo ""
echo "Supplied API Keys will be removed upon completion."
echo ""
echo "Starting gov-cloud-import deployment to $GOV_REGION and $COM_REGION."
echo ""
echo ""
echo "Making S3 Bucket in $COM_REGION"
echo ""
#Make Bucket
RAND=$(openssl rand -base64 100 | tr -dc 'a-z0-9' | fold -w 16 | head -n 1)

aws s3 mb s3://gov-cloud-import-$RAND --profile com12345  > /dev/null

echo '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicListGet",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:List*",
                "s3:Get*"
            ],
            "Resource": [
                "arn:aws:s3:::gov-cloud-import-'$RAND'",
                "arn:aws:s3:::gov-cloud-import-'$RAND'/*"
            ]
        }
    ]
} ' > policy.json

aws s3api put-bucket-policy --bucket gov-cloud-import-$RAND --policy file://policy.json --profile com12345
rm policy.json
#Save Bucket As Parameter
aws ssm put-parameter --name "gov-cloud-import-app" --type "String" --value "gov-cloud-import-$RAND" --overwrite --profile com12345 > /dev/null

echo "Copying App to S3 Bucket in $COM_REGION"
echo ""
#Sync the local repo clone to new s3 buckets
aws s3 sync ./ s3://gov-cloud-import-$RAND --quiet  --profile com12345

#Update Scripts with New Bucket Location
#BUCKET_BASE_URL="https://s3.$COM_REGION.amazonaws.com/gov-cloud-import-$RAND"
BUCKET_BASE="gov-cloud-import-$RAND"
BUCKET_BASE_URL="https://s3.$COM_REGION.amazonaws.com/gov-cloud-import-$RAND"

sed -ie "s|<BUCKET_BASE>|$BUCKET_BASE|g" ec2/gov-cloud-import-ec2prep.sh
sed -ie "s|<BUCKET_BASE>|$BUCKET_BASE|g" cloudformation/gov-cloud-import-commercial.json

#Zip up lambda files
echo "Compressing Lambda Functions"
echo ""
chmod -R 755 lambda/
cd lambda
for i in `find . -type d | tail -n +2 | tr -d './'`
do
    if [[ $i == "." ]]; then
      echo "Root Directory"
    else
      cd $i
      zip -X ../$i.zip index.js
      cd ../
    fi
done
cd ..
echo ""
echo "Synchronizing files to S3 bucket"
#Sync Files to Bucket
aws s3 sync ./ s3://gov-cloud-import-$RAND --profile com12345 --quiet

echo "Deploying CloudFormations"
#Start Cloudformation
aws cloudformation create-stack --stack-name gov-cloud-import --template-body file://cloudformation/gov-cloud-import-commercial.json --capabilities CAPABILITY_IAM --profile com12345
aws cloudformation create-stack --stack-name gov-cloud-import --template-body file://cloudformation/gov-cloud-import-govcloud-$CARD_DIR.json --capabilities CAPABILITY_NAMED_IAM --profile gov12345
if [ "$ROLE_STATUS" != "vmie.amazonaws.com" ]; then
  aws cloudformation create-stack --stack-name gov-cloud-import-vmimport --template-body file://cloudformation/gov-cloud-import-govcloud-vmimport.json --capabilities CAPABILITY_NAMED_IAM --profile gov12345
fi
#Watch Formations
echo ""
echo "Script will check Cloudformation status every 30 seconds until complete."
echo "This will take 5+ mins to complete."
echo ""

while :
do
  COM_STATUS=$(aws cloudformation describe-stacks --stack-name gov-cloud-import --profile com12345 | awk 'NF>1{print $NF}' | head -n 1)
  GOV_STATUS=$(aws cloudformation describe-stacks --stack-name gov-cloud-import --profile gov12345 | awk 'NF>1{print $NF}' | head -n 1)
  NOW=$(date +%Y-%m-%d_%H:%M:%S)
  if [ $GOV_STATUS == "CREATE_IN_PROGRESS" ] || [ $COM_STATUS == "CREATE_IN_PROGRESS" ]; then
    echo "$NOW AWS GovCloud (US) Status: $GOV_STATUS"
    echo "$NOW AWS Status: $COM_STATUS"
  elif [ $GOV_STATUS == "ROLLBACK_IN_PROGRESS" ] && [ $COM_STATUS == "ROLLBACK_IN_PROGRESS" ]; then
    echo ""
    echo "Something went wrong with Cloudformation"
    echo "$NOW AWS GovCloud (US) Status: $GOV_STATUS"
    echo "$NOW AWS Status: $COM_STATUS"
    exit
  elif [ $GOV_STATUS == "CREATE_COMPLETE" ] && [ $COM_STATUS == "CREATE_COMPLETE" ]; then
    echo "$NOW AWS GovCloud (US) Status: $GOV_STATUS"
    echo "$NOW AWS Status: $COM_STATUS"
    break
  fi
  sleep 30
done


#Make AWS GovCloud (US) API Keys
echo ""
echo "Creating AWS GovCloud (US) Access Keys and Storing them in AWS SSM Parameters."
CREATE_KEYS=$(aws iam create-access-key --user-name gov-cloud-import-user-$CARD_DIR --profile gov12345)
ACCESS_KEY=$(echo $CREATE_KEYS | awk '{print $2}')
SECRET_KEY=$(echo $CREATE_KEYS | awk '{print $4}')
GOV_BUCKET=$(aws cloudformation describe-stacks --stack-name gov-cloud-import --profile gov12345 | awk '/gov-cloud-import-bucket*/ {print $8}')
echo $GOV_BUCKET
#Submit Parameters to AWS
aws ssm put-parameter --name "gov-cloud-import-accessKey" --overwrite  --type "SecureString" --value $ACCESS_KEY --profile com12345 > /dev/null
aws ssm put-parameter --name "gov-cloud-import-secretKey"  --overwrite --type "SecureString" --value $SECRET_KEY --profile com12345 > /dev/null
aws ssm put-parameter --name "gov-cloud-import-s3Bucket" --overwrite  --type "String" --value $GOV_BUCKET --profile com12345 > /dev/null

#Remove Creds/Keys and Config
clear
cat << "EOF"
                            _                 _       _                            _
  __ _  _____   __      ___| | ___  _   _  __| |     (_)_ __ ___  _ __   ___  _ __| |_
 / _` |/ _ \ \ / /____ / __| |/ _ \| | | |/ _` |_____| | '_ ` _ \| '_ \ / _ \| '__| __|
| (_| | (_) \ V /_____| (__| | (_) | |_| | (_| |_____| | | | | | | |_) | (_) | |  | |_
 \__, |\___/ \_/       \___|_|\___/ \__,_|\__,_|     |_|_| |_| |_| .__/ \___/|_|   \__|
 |___/                                                           |_|

Written by awsjason
Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Amazon Software License (the "License"). You may not
use this file except in compliance with the License.
EOF
echo ""
echo "Removing Install API Keys and Config."
sed -e :a -e '$d;N;2,6ba' -e 'P;D' ~/.aws/credentials > file.txt
chmod 600 file.txt
mv file.txt ~/.aws/credentials
sed -e :a -e '$d;N;2,6ba' -e 'P;D' ~/.aws/config > file.txt
chmod 600 file.txt
mv file.txt ~/.aws/config


#Display S3 Bucket
echo ""
echo "Install of gov-cloud-import Complete!"
echo ""
echo "Your import web interface is ready @ $BUCKET_BASE_URL/index.html"
echo ""
echo "This Read-only bucket contains a copy of the application from Github, but was created"
echo "PUBLICLY EXPOSED.  Please stay within your company's security posture."
echo ""
echo ""
echo ""
