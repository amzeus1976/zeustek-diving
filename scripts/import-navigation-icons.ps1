param(
  [Parameter(Mandatory=$true)][string]$ArchivePath
)

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sources=Get-Content -LiteralPath (Join-Path $repo 'lib/brand/navigation-icon-sources.json') -Raw | ConvertFrom-Json
if($sources.Count -ne 31){throw 'Navigation icon source list must contain exactly 31 routes.'}
$archive=[IO.Compression.ZipFile]::OpenRead($ArchivePath)
try{
  $pngEntries=@($archive.Entries | Where-Object {$_.FullName.EndsWith('.png',[StringComparison]::OrdinalIgnoreCase)})
  if($pngEntries.Count -ne 31){throw 'The supplied archive must contain exactly 31 PNG files.'}
  $listed=@($sources | ForEach-Object {$_.archivePath})
  if((@($listed | Select-Object -Unique)).Count -ne 31){throw 'Navigation icon source paths must be unique.'}
  $masterRoot=[IO.Path]::GetFullPath((Join-Path $repo 'assets/navigation-icons/master'))
  $runtimeRoot=[IO.Path]::GetFullPath((Join-Path $repo 'public/brand/icons/navigation'))
  [IO.Directory]::CreateDirectory($masterRoot) | Out-Null
  [IO.Directory]::CreateDirectory($runtimeRoot) | Out-Null
  $manifest=@()
  foreach($item in $sources){
    $entryPath=[string]$item.archivePath
    if($entryPath -notmatch '^(?:batch_[123]/)?[a-z0-9_]+\.png$'){throw "Unsafe archive entry: $entryPath"}
    $entry=$archive.GetEntry($entryPath)
    if($null -eq $entry){throw "Missing approved artwork: $entryPath"}
    $filename=[IO.Path]::GetFileName($entryPath)
    $master=[IO.Path]::GetFullPath((Join-Path $masterRoot $entryPath))
    $runtime=[IO.Path]::GetFullPath((Join-Path $runtimeRoot $filename))
    if(!$master.StartsWith($masterRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or !$runtime.StartsWith($runtimeRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Icon output escaped the project asset directory.'}
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($master)) | Out-Null
    $inputStream=$entry.Open()
    try{$memory=New-Object IO.MemoryStream;$inputStream.CopyTo($memory);$bytes=$memory.ToArray();$memory.Dispose()}finally{$inputStream.Dispose()}
    if([IO.File]::Exists($master)){
      $previous=[IO.File]::ReadAllBytes($master)
      if(![Linq.Enumerable]::SequenceEqual([byte[]]$previous,[byte[]]$bytes)){throw "Existing master differs from supplied archive: $entryPath"}
    }else{[IO.File]::WriteAllBytes($master,$bytes)}
    $sourceStream=New-Object IO.MemoryStream(,$bytes)
    try{
      $image=[Drawing.Image]::FromStream($sourceStream)
      try{
        if($image.Width -ne 1254 -or $image.Height -ne 1254){throw "Unexpected master dimensions: $entryPath"}
        $bitmap=New-Object Drawing.Bitmap(128,128,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try{
          $graphics=[Drawing.Graphics]::FromImage($bitmap)
          try{
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($image,[Drawing.Rectangle]::new(0,0,128,128),[Drawing.Rectangle]::new(0,0,1254,1254),[Drawing.GraphicsUnit]::Pixel)
          }finally{$graphics.Dispose()}
          $bitmap.Save($runtime,[Drawing.Imaging.ImageFormat]::Png)
        }finally{$bitmap.Dispose()}
      }finally{$image.Dispose()}
    }finally{$sourceStream.Dispose()}
    $manifest+=@{
      route=[string]$item.route
      masterPath=('assets/navigation-icons/master/'+$entryPath)
      masterSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $master).Hash.ToLowerInvariant()
      src=('/brand/icons/navigation/'+$filename)
      scale=1
    }
  }
  $manifestPath=Join-Path $repo 'lib/brand/navigation-icon-manifest.json'
  $json=ConvertTo-Json -InputObject @($manifest) -Depth 4
  [IO.File]::WriteAllText($manifestPath,($json -replace "`r`n","`n")+"`n",[Text.UTF8Encoding]::new($false))
  Write-Output "Imported $($manifest.Count) unchanged masters and 128px navigation derivatives."
}finally{$archive.Dispose()}
