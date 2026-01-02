<?php
$file = 'reports.json';
$now = time();
$expiry = 20 * 60; // 20 minuuttia sekunteina

// Ladataan nykyiset tiedot
$data = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
if (!is_array($data)) $data = [];

// SIIVOUS: Pidetään vain tuoreet ilmoitukset
$data = array_filter($data, function($report) use ($now, $expiry) {
    return ($now - $report['time']) < $expiry;
});

// LISÄYS: Jos tuli uusi raportti
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['lat']) && isset($_POST['lon'])) {
    $newReport = [
        'id' => uniqid(),
        'lat' => floatval($_POST['lat']),
        'lon' => floatval($_POST['lon']),
        'time' => $now
    ];
    $data[] = $newReport;
}

// Tallennetaan päivitetty lista takaisin tiedostoon
file_put_contents($file, json_encode(array_values($data)));

// Palautetaan lista selaimelle JSON-muodossa
header('Content-Type: application/json');
echo json_encode($data);
?>
