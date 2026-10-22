param([int]$Tamanho = 16)

# Gera senha aleatoria com fonte criptografica (RandomNumberGenerator).
# Uso: .\gerador-de-senha.ps1 -Tamanho 16

if ($Tamanho -lt 8 -or $Tamanho -gt 64) {
  throw "Tamanho deve estar entre 8 e 64 caracteres"
}

$alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*+-"
$limite = [math]::Floor(256 / $alfabeto.Length) * $alfabeto.Length
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$buffer = New-Object byte[] 1
$saida = New-Object System.Text.StringBuilder

while ($saida.Length -lt $Tamanho) {
  $rng.GetBytes($buffer)
  if ($buffer[0] -lt $limite) {
    [void]$saida.Append($alfabeto[$buffer[0] % $alfabeto.Length])
  }
}

$rng.Dispose()
$saida.ToString()