<?php
// api/billing_clients.php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// use the shared PDO from db_config.php
require __DIR__ . '/../db_config.php';  // this gives us $pdo

try {
    $sql = "
        SELECT 
            id,
            name,
            email,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            zip,
            CONCAT_WS(
                ', ',
                NULLIF(address_line1, ''),
                NULLIF(address_line2, ''),
                NULLIF(city, ''),
                NULLIF(state, ''),
                NULLIF(zip, '')
            ) AS full_address
        FROM clients
        ORDER BY created_at DESC
    ";

    $stmt = $pdo->query($sql);
    $clients = $stmt->fetchAll();   // returns an array of rows

    echo json_encode([
        "results" => $clients
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "error" => "Failed to load clients."
    ]);
    // optional: log $e->getMessage() to a file, but don't show to user
}
