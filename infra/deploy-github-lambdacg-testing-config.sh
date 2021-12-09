#!/bin/bash

set -e

script_dir=`dirname $0`
stack_name="github-lambdacg-testing-config"
template_file="${script_dir}/github-lambdacg-testing-config.yaml"

toolsMessage=<<EOF
You need the following tools to run this script:
- AWS CLI (https://aws.amazon.com/cli/)
- git command line client (https://git-scm.com/)
- jq (https://stedolan.github.io/jq/)

One or more of these are not on your PATH. Please make sure they are, and
come back.
EOF

if ! which aws &>/dev/null; then
    echo "$toolsMessage" >&2
    echo >&2
    exit 1;
fi

if ! which jq &>/dev/null; then
    echo $toolsMessage >&2
    echo >&2
    exit 1;
fi

if ! which git &>/dev/null; then
    echo $toolsMessage >&2
    echo >&2
    exit 1;
fi

echo "Script directory is '${script_dir}'"
echo

echo -n "Determining GitHub repo based on git remotes... "

github_repos=`git remote -v | sed -nE 's~^.*https://github\.com/([^ ]*)\.git.*$~\1~p' | sort -u`
github_repos_count=`wc -l <<< "$github_repos"`

if [ -z "$github_repos" ]; then
    echo
    echo
    echo "There is no remote from GitHub, bailing out" >&2
    echo >&2
    exit 1
elif [ "$github_repos_count" -ne "1" ]; then
    echo
    echo
    echo "There is more than one remote from GitHub, bailing out" >&2
    echo >&2
    exit 1
fi

echo ${github_repos}
echo

echo -n "Checking AWS configuration"
echo 

aws_identity_json=`aws sts get-caller-identity`
aws_user_arn=`jq .Arn <<< "${aws_identity_json}"`
aws_account_id=`jq .Account <<< "${aws_identity_json}"`

echo "done"
echo

echo "You are about to deploy lambdacg test configuration for GitHub repo ${github_repos} "
echo "to AWS account ${aws_account_id} with credentials  ${aws_user_arn}."
echo
echo "This means GitHub Actions for repository ${github_repos} will have access to "
echo "AWS account ${aws_account_id} for unit / integration tests."
echo
echo "The configuration will be deployed as a cloudformation stack with the name "
echo "'${stack_name}'."
echo "You will be able to delete this cloudformation stack at any time."
echo 
echo "Please type the exact phrase 'Yes I am sure' (without quotes) if you are sure "
echo "you want to proceed."
echo 
echo -n  "> "
read yesIAmSure 

if [ "$yesIAmSure" != "Yes I am sure" ]; then
    echo "Bummer! Better luck next time" >&2
    echo &>2
    exit 1
fi

echo
echo "Okay, deploying!"


aws cloudformation deploy \
    --template-file "${template_file}" \
    --stack-name "${stack_name}" \
    --parameter-overrides "FullRepoName=${github_repos}" \
    --capabilities CAPABILITY_NAMED_IAM

echo
echo "Deployed ${template_file} with FullRepoName=${github_repos}"
echo
