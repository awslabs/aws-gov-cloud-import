#!/bin/bash

######################################################################################################################
#  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  SPDX-License-Identifier: Apache-2.0                                                                               #
######################################################################################################################

#Passed Variables
while getopts b: OPTION
do
    case "${OPTION}"
    in
    b) BUCKET=$OPTARG;;
    esac
done


s3_verify(){
    NOW=$(date +%a" "%b" "%d" "%Y" "%R:%S" GMT"%z" ("%Z")")
    #We're trusting that if its a running process, its up...
    MOUNTED_BUCKET=$(ps aux | awk '/home\/ec2-user\/s3fs\/'$BUCKET'/ {print $12}')
    MOUNTED_BUCKET_PID=$(ps aux | awk '/home\/ec2-user\/s3fs\/'$BUCKET'/ {print $2}')
    if [[ $MOUNTED_BUCKET == $BUCKET ]]; then
        echo "$NOW $BUCKET still mounted attempting to kill the process" >> /home/ec2-user/log
        kill -15 $MOUNTED_BUCKET_PID
        MOUNTED_BUCKET=$(ps aux | awk '/home\/ec2-user\/s3fs\/'$BUCKET'/ {print $12}')
        if [[ $MOUNTED_BUCKET == $BUCKET ]]; then
            echo "$NOW $BUCKET still mounted and couldn't kill the process" >> /home/ec2-user/log
        else
          DIR="/home/ec2-user/s3fs/$BUCKET"
          # look for empty dir
          if [ "$(ls -A $DIR)" ]; then
             echo "$NOW $DIR has files, can't remove folder" >> /home/ec2-user/log
          else
             echo "$NOW $DIR has been removed" >> /home/ec2-user/log
          fi
          rm -fr /home/ec2-user/s3fs/$BUCKET
        fi
    else
        DIR="/home/ec2-user/s3fs/$BUCKET"
        # look for empty dir
        if [ "$(ls -A $DIR)" ]; then
           echo "$NOW $DIR has files, can't remove folder" >> /home/ec2-user/log
        else
           echo "$NOW $DIR has been removed" >> /home/ec2-user/log
        fi
        rm -fr /home/ec2-user/s3fs/$BUCKET
    fi
}

clear_cache(){
    rm -rf /tmp/$bucket
    if [[ -d /tmp/$BUCKET ]]; then
        rm -rf /tmp/$BUCKET
    fi
    if [[ -d /tmp/.$BUCKET ]]; then
        rm -rf /tmp/.$BUCKET
    fi
}

s3_log(){
    if [ ! -d "/home/ec2-user/s3fs/$BUCKET" ]; then
        NOW=$(date +%a" "%b" "%d" "%Y" "%R:%S" GMT"%z" ("%Z")")
        echo "$NOW Successfully umount S3 Bucket $BUCKET"  >> /home/ec2-user/log
    else
        echo "$NOW Error on unmount of Bucket $BUCKET or directory removal" >> /home/ec2-user/log
    fi
}

#Unmount Bucket
sleep 3
umount /home/ec2-user/s3fs/$BUCKET
sleep 3
s3_verify
clear_cache
s3_log
