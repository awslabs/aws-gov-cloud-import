#!/bin/bash

######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################

#Update Instance
sudo yum update -y

#Install scripts
cd /home/ec2-user
aws s3 cp s3://<BUCKET_BASE>/ec2/gov-cloud-import.js ./
curl --silent --location https://rpm.nodesource.com/setup_9.x | sudo bash -

#Shell Scripts
mkdir /home/ec2-user/shell
cd /home/ec2-user/shell
aws s3 cp s3://<BUCKET_BASE>/ec2/umountBucket.sh ./
aws s3 cp s3://<BUCKET_BASE>/ec2/mountBucket.sh ./
chmod +x *.sh
cd /home/ec2-user/

#Install binaries
sudo yum install -y gcc libstdc++-devel gcc-c++ fuse fuse-devel curl-devel libxml2-devel mailcap automake openssl-devel git mlocate figlet awslogs nodejs

#Install Nodejs modules
sudo -H -u ec2-user bash -c 'npm install xmlhttprequest && npm install aws-sdk && npm install executive && npm install s3-node-client && npm install copy-dynamodb-table'

#Install S3fs
sudo git clone https://github.com/s3fs-fuse/s3fs-fuse
cd s3fs-fuse/
sudo ./autogen.sh
sudo ./configure --prefix=/usr --with-openssl
sudo make
sudo make install
cd ../

#Mount point for commercial buckets
mkdir /home/ec2-user/s3fs
#Clean Up
sudo rm -rf /home/ec2-user/s3fs-fuse

#Update MOTD to look kewl
sudo touch /etc/update-motd.d/90-footer
sudo chmod 777 /etc/update-motd.d/90-footer
echo "figlet -t 'gov-cloud-import'" >> /etc/update-motd.d/90-footer
echo "echo" >> /etc/update-motd.d/90-footer
echo "echo 'Written by awsjason'" >> /etc/update-motd.d/90-footer
echo "echo" >> /etc/update-motd.d/90-footer
sudo chmod 755 /etc/update-motd.d/90-footer
sudo update-motd

#Set Up Variables
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
EC2_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/\(.*\)[a-z]/\1/')
#ROOT_VOL=$(aws ec2 describe-instance-attribute --instance-id $INSTANCE_ID \
#--attribute blockDeviceMapping --region $EC2_REGION | awk '/vol-*/ {print $2}' \
#| tr -d '",')
#echo $ROOT_VOL > /home/ec2-user/rootVol

#Setup awslogs
#Add S3 Sync Logs
sudo echo '
[syncLog]
datetime_format = %b %d %H:%M:%S
file = /home/ec2-user/s3SyncLog
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = /gov-cloud-import/s3Synclog
' >> /etc/awslogs/awslogs.conf
#Replace the default with our app
sed -i 's|file = /var/log/messages|file = /home/ec2-user/log|g' /etc/awslogs/awslogs.conf
sed -i 's|/var/log/messages|/gov-cloud-import/EC2Worker|g' /etc/awslogs/awslogs.conf
sed -i 's|log_group_name = /var/log/messages|log_group_name = /gov-cloud-import/ec2Worker|g' /etc/awslogs/awslogs.conf
sed -i "s/us-east-1/$EC2_REGION/g" /etc/awslogs/awscli.conf
#Start Service
sudo service awslogs start
sudo chkconfig awslogs on

#run gov-cloud-script.js and check every 5 minutes if its running
echo '*/5 * * * * root /bin/bash /home/ec2-user/shell/gov-cloud-import-cron.sh' > /etc/cron.d/gov-cloud-import-run-node.sh
chmod 600 /etc/cron.d/gov-cloud-import-run-node.sh

#Script for starting and verifing Node is running
echo '
#!/bin/bash
NOW=$(date +%a" "%b" "%d" "%Y" "%R:%S" GMT"%z" ("%Z")")
NODE_PID=$(cat /home/ec2-user/gov-cloud-import-node-pid)
NODE_VERIFY=$(ps aux |  grep gov-cloud-import.js | grep sudo | awk *{print $2}*)

if [[ -z $NODE_PID ]]; then
    sudo node /home/ec2-user/gov-cloud-import.js & >> /home/ec2-user/log
    echo "$NOW gov-cloud-import.js is starting Node PID: $!" >> /home/ec2-user/log
    echo $! >  /home/ec2-user/gov-cloud-import-node-pid
elif [[ $NODE_PID == $NODE_VERIFY ]]; then
    echo "$NOW gov-cloud-import.js is running. Node PID: $NODE_PID" >> /home/ec2-user/log
else
    sudo node /home/ec2-user/gov-cloud-import.js & >> /home/ec2-user/log
    echo "$NOW gov-cloud-import.js is starting Node PID: $!" >> /home/ec2-user/log
    echo $! >  /home/ec2-user/gov-cloud-import-node-pid
fi' > /home/ec2-user/shell/gov-cloud-import-cron.sh
chmod +rx /home/ec2-user/shell/gov-cloud-import-cron.sh
sed -i 's/*/\x27/g' /home/ec2-user/shell/gov-cloud-import-cron.sh
touch /home/ec2-user/gov-cloud-import-node-pid

#Start Node
/home/ec2-user/shell/gov-cloud-import-cron.sh
