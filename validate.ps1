$files = Get-ChildItem -Path "docs/fichas/cover-creator-for-kindle/" -Filter "*.md" | Where-Object { $_.Name -ne "strategy-matrix.md" }
$errors = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name

    # 1. Sections validation
    $requiredSections = @(
        "Nombre de la app", "Descripción corta", "Descripción larga", "Decisión", 
        "Estrategia", "Sistema visual", "Gráfico promocional", 
        "Captura 1", "Captura 2", "Captura 3", "Captura 4", "Captura 5", "Notas / Supuestos"
    )
    foreach ($section in $requiredSections) {
        # Using a flexible match for sections that might have slightly different names but contain the keyword
        $found = $false
        if ($content -match "## .*$section") { $found = $true }
        
        if (-not $found) {
            $errors.Add("$fileName: Sección faltante o mal nombrada: $section")
        }
    }

    # 2. Texto seleccionado <= 80 chars
    if ($content -match "(?m)^Texto seleccionado:\s*(.*)") {
        $text = $Matches[1].Trim()
        if ($text.Length -gt 80) {
            $errors.Add("$fileName: Texto seleccionado > 80 chars ($($text.Length))")
        }
    }

    # 3. Nombre localizado sugerido <= 30 chars
    if ($content -match "(?m)^Nombre localizado sugerido.*:\s*(.*)") {
        $nameSug = $Matches[1].Trim()
        if ($nameSug.Length -gt 30) {
            $errors.Add("$fileName: Nombre sugerido > 30 chars ($($nameSug.Length))")
        }
    }

    # 4. Descripción larga <= 4000 chars
    if ($content -match "(?ms)## Descripci.*?n larga.*?Texto:\s*(.*?)(?=\r?\n##|$)") {
        $descLarga = $Matches[1].Trim()
        if ($descLarga.Length -gt 4000) {
            $errors.Add("$fileName: Descripción larga > 4000 chars ($($descLarga.Length))")
        }
    }

    # 5 & 6. Bloques 'fondo:' validation
    $fondoRegex = "(?ms)^fondo:\s*(.*?)(?=\r?\n\w+:|\n\n|\Z)"
    $fondoMatches = [regex]::Matches($content, $fondoRegex)
    $requiredFondoKeys = @("dimension", "base principal", "secundario", "acento", "ubicacion del acento", "zona segura de copy", "textura permitida", "elementos prohibidos")
    
    foreach ($m in $fondoMatches) {
        $fondoBlock = $m.Groups[1].Value
        foreach ($key in $requiredFondoKeys) {
            if ($fondoBlock -notmatch "- $key") {
                $errors.Add("$fileName: Bloque fondo falta clave: $key")
            }
        }
        # Check at least 3 hex colors
        $hexMatches = [regex]::Matches($fondoBlock, "#[0-9A-Fa-f]{3,6}")
        if ($hexMatches.Count -lt 3) {
            $errors.Add("$fileName: Bloque fondo tiene menos de 3 hex colors")
        }
    }

    # 7. Wrappers kindle/e-reader emulado image size
    $wrapperKindleRegex = "(?ms)wrapper:\s*kindle/e-reader emulado.*?imagen:\s*imagen\s+(\d+x\d+)"
    $kindleMatches = [regex]::Matches($content, $wrapperKindleRegex)
    foreach ($m in $kindleMatches) {
        if ($m.Groups[1].Value -ne "1313x1751") {
            $errors.Add("$fileName: Wrapper kindle/e-reader emulado imagen incorrecta: $($m.Groups[1].Value) (esperado 1313x1751)")
        }
    }

    # 8. Wrappers captura directa de app fondo size
    $wrapperCapturaRegex = "(?ms)wrapper:\s*captura directa de app.*?fondo:.*?- dimension:\s+(\d+x\d+)"
    $capturaMatches = [regex]::Matches($content, $wrapperCapturaRegex)
    foreach ($m in $capturaMatches) {
        if ($m.Groups[1].Value -ne "1994x3456") {
            $errors.Add("$fileName: Wrapper captura directa de app fondo incorrecto: $($m.Groups[1].Value) (esperado 1994x3456)")
        }
    }
}

if ($errors.Count -eq 0) { "OK" } else { $errors }
