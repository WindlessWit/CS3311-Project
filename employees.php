<?php

require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT id, name, role FROM employees ORDER BY name");
    $employees = $stmt->fetchAll();

    echo json_encode([
        'employees' => $employees
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to fetch employees.'
    ]);
}
