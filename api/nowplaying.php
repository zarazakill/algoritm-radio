<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$azuraCastApiUrl = 'https://wwcat.duckdns.org/api/nowplaying/1';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $azuraCastApiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
