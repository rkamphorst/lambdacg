#!/bin/bash

echo "Determining GitHub repo based on git remotes..."

github_repos=`git remote -v | sed -nE 's~^.*https://github\.com/([^ ]*)\.git.*$~\1~p' | sort -u`
github_repos_count=`wc -l <<< "$github_repos"`

if [ -z "$github_repos" ]; then
    echo "There is no remote from GitHub, bailing out" >&2
    exit 1
elif [ "$github_repos_count" -ne "1" ]; then
    echo "There is more than one remote from GitHub, bailing out"
    exit 1
fi

echo "GitHub repository: $github_repos"
