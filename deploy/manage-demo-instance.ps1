param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('status','start','stop')]
  [string]$Action
)
$ErrorActionPreference='Stop'
$statePath=Join-Path $PSScriptRoot '../.aws/fitness-demo-state.json'
if (-not (Test-Path -LiteralPath $statePath)) { throw 'Falta el estado privado local del despliegue.' }
$deployment=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($deployment.InstanceId -notmatch '^i-[a-f0-9]+$' -or $deployment.Region -ne 'us-west-2') { throw 'Instancia o region inesperadas.' }
$profileArguments=@()
if ($deployment.Profile) { $profileArguments=@('--profile', [string]$deployment.Profile) }
$expectedAccount=if ($deployment.AccountId) { [string]$deployment.AccountId } else { ([string]$deployment.DeployRoleArn -split ':')[4] }
if ($expectedAccount -notmatch '^\d{12}$') { throw 'Falta identificar la cuenta AWS del despliegue.' }
$activeAccount=aws sts get-caller-identity @profileArguments --query Account --output text
if ($LASTEXITCODE -ne 0 -or $activeAccount -ne $expectedAccount) { throw 'La cuenta AWS activa no corresponde a esta instancia. No se realizo ninguna operacion.' }
switch ($Action) {
  'start' { aws ec2 @profileArguments start-instances --region $deployment.Region --instance-ids $deployment.InstanceId --query 'StartingInstances[].CurrentState.Name' --output text }
  'stop' { aws ec2 @profileArguments stop-instances --region $deployment.Region --instance-ids $deployment.InstanceId --query 'StoppingInstances[].CurrentState.Name' --output text }
  'status' { aws ec2 @profileArguments describe-instances --region $deployment.Region --instance-ids $deployment.InstanceId --query 'Reservations[].Instances[].{Estado:State.Name,IP:PublicIpAddress,Tipo:InstanceType}' --output table }
}
if ($LASTEXITCODE -ne 0) { throw 'AWS no completo la operacion.' }
