Write-Host "Node işlemleri sonlandırılıyor (Dosya kilitlerini açmak için)..."
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host "Bozuk oturum dosyaları siliniyor..."
Remove-Item -Recurse -Force .wwebjs_auth -ErrorAction SilentlyContinue
Write-Host "Temizlik tamamlandı. Lütfen 'npm start' komutunu tekrar çalıştırın."
