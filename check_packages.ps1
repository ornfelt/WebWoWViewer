# You can also use: npm install -g npm-check-updates
# then: ncu
# if you wish to proceed with updates: ncu -u

$packageJsonPath = "./package.json"

$packageJson = Get-Content $packageJsonPath | Out-String | ConvertFrom-Json

Write-Host "Checking packages in package.json..."

$allPackages = @()

Write-Host "Dependencies:"
$packageJson.dependencies.PSObject.Properties | ForEach-Object { 
    $currentVersion = $_.Value
    $latestVersion = npm view $_.Name version
    Write-Host "$($_.Name) current version is $currentVersion, latest version is $latestVersion"
}

Write-Host "DevDependencies:"
# Loop through devDependencies and fetch the latest version
$packageJson.devDependencies.PSObject.Properties | ForEach-Object { 
    $currentVersion = $_.Value
    $latestVersion = npm view $_.Name version
    Write-Host "$($_.Name) current version is $currentVersion, latest version is $latestVersion"
}

# Combining all packages:
#$packageJson.dependencies.PSObject.Properties | ForEach-Object { $allPackages += @{ Name = $_.Name; CurrentVersion = $_.Value } }
#$packageJson.devDependencies.PSObject.Properties | ForEach-Object { $allPackages += @{ Name = $_.Name; CurrentVersion = $_.Value } }

#foreach ($package in $allPackages) {
#    $latestVersion = npm view $package.Name version
#    Write-Host "$($package.Name) current version is $($package.CurrentVersion), latest version is $latestVersion"
#}