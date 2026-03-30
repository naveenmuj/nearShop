# Create the required directories
$directories = @(
    "d:\Local_shop\nearshop-api\app\messaging",
    "d:\Local_shop\nearshop-api\app\returns",
    "d:\Local_shop\nearshop-api\app\staff",
    "d:\Local_shop\nearshop-api\app\giftcards",
    "d:\Local_shop\nearshop-api\app\subscriptions"
)

foreach ($dir in $directories) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created: $dir"
    } else {
        Write-Host "Already exists: $dir"
    }
}

Write-Host "All directories processed successfully!"
