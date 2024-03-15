#!/bin/bash

# You can also use: npm install -g npm-check-updates
# then: ncu
# if you wish to proceed with updates: ncu -u

packageJsonPath="./package.json"

echo "Checking packages in package.json..."

echo "Dependencies:"
for packageName in $(jq -r '.dependencies | keys | .[]' $packageJsonPath); do
    currentVersion=$(jq -r --arg pkg "$packageName" '.dependencies[$pkg]' $packageJsonPath)
    latestVersion=$(npm view $packageName version)
    echo "$packageName current version is $currentVersion, latest version is $latestVersion"
done

echo "DevDependencies:"
for packageName in $(jq -r '.devDependencies | keys | .[]' $packageJsonPath); do
    currentVersion=$(jq -r --arg pkg "$packageName" '.devDependencies[$pkg]' $packageJsonPath)
    latestVersion=$(npm view $packageName version)
    echo "$packageName current version is $currentVersion, latest version is $latestVersion"
done

# Combining all packages:
#packages=$(cat $packageJsonPath | jq '.dependencies, .devDependencies | keys | .[]' | tr -d '"' | tr -d ',')

#for packageName in $packages; do
#    latestVersion=$(npm view $packageName version)
#    echo "$packageName latest version is $latestVersion"
#done