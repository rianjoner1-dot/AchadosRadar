Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path (Get-Location) 'docs/marketing'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputPath = Join-Path $outputDirectory 'teaser-vem-ai-01.png'
$capturePath = Join-Path $env:TEMP 'achados-responsive-home.png'
$capture = [System.Drawing.Bitmap]::FromFile($capturePath)
$canvas = [System.Drawing.Bitmap]::new(1080, 1350)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function New-RoundedPath([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

try {
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1080, 1350),
    [System.Drawing.Color]::FromArgb(255, 10, 79, 142),
    [System.Drawing.Color]::FromArgb(255, 9, 25, 48),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillRectangle($background, 0, 0, 1080, 1350)
  $background.Dispose()

  foreach ($ring in @(250, 420, 590)) {
    $ringPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(28, 255, 255, 255), 2)
    $graphics.DrawEllipse($ringPen, 570 - ($ring / 2), 810 - ($ring / 2), $ring, $ring)
    $ringPen.Dispose()
  }
  $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 174, 78))
  $graphics.FillEllipse($accent, 814, 684, 14, 14)
  $accent.Dispose()

  $eyebrowFont = [System.Drawing.Font]::new('Segoe UI', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleFont = [System.Drawing.Font]::new('Segoe UI', 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $copyFont = [System.Drawing.Font]::new('Segoe UI', 27, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $footerFont = [System.Drawing.Font]::new('Segoe UI', 17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 229, 240, 249))
  $orange = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 190, 110))
  $eyebrowText = 'ACHADOS RADAR   ' + [char]0x2022 + '   TEM NOVIDADE CHEGANDO'
  $titleLineOne = 'Seu pr' + [char]0x00F3 + 'ximo achado'
  $titleLineTwo = 'est' + [char]0x00E1 + ' no radar.'
  $graphics.DrawString($eyebrowText, $eyebrowFont, $orange, 70, 62)
  $graphics.DrawString($titleLineOne, $titleFont, $white, 66, 119)
  $graphics.DrawString($titleLineTwo, $titleFont, $white, 66, 202)
  $graphics.DrawString('Compare ofertas de lojas parceiras e escolha', $copyFont, $muted, 72, 315)
  $graphics.DrawString('com calma onde finalizar sua compra.', $copyFont, $muted, 72, 351)

  $phoneShadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(85, 0, 0, 0))
  $phoneBody = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 8, 14, 22))
  $phoneBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 68, 83, 101), 2)
  $phonePath = New-RoundedPath 333 455 414 820 46
  $graphics.FillPath($phoneShadow, (New-RoundedPath 345 469 414 820 46))
  $graphics.FillPath($phoneBody, $phonePath)
  $graphics.DrawPath($phoneBorder, $phonePath)
  $phoneShadow.Dispose()
  $phoneBody.Dispose()
  $phoneBorder.Dispose()

  $screenPath = New-RoundedPath 352 478 376 778 31
  $state = $graphics.Save()
  $graphics.SetClip($screenPath)
  $sourceRect = [System.Drawing.Rectangle]::new(0, 0, $capture.Width, [Math]::Min(810, $capture.Height))
  $graphics.DrawImage($capture, [System.Drawing.Rectangle]::new(352, 478, 376, 778), $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Restore($state)
  $screenBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 116, 130, 146), 1)
  $graphics.DrawPath($screenBorder, $screenPath)
  $screenBorder.Dispose()

  $speakerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 30, 38, 48))
  $graphics.FillEllipse($speakerBrush, 521, 465, 36, 5)
  $speakerBrush.Dispose()
  $cameraBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 39, 54, 69))
  $graphics.FillEllipse($cameraBrush, 570, 463, 7, 7)
  $cameraBrush.Dispose()

  $footer = 'Pre' + [char]0x00E7 + 'o, frete e disponibilidade podem mudar na loja de destino.'
  $graphics.DrawString($footer, $footerFont, $muted, 72, 1307)
  $graphics.DrawString('Achados Radar', $eyebrowFont, $white, 72, 1272)

  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $outputPath
} finally {
  $capture.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
