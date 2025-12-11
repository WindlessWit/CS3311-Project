<?php
// api/billing_quote_get.php
// Return a single quote plus its line items, for loading into the editor.

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/../db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid quote id']);
    exit;
}

try {
    // Fetch quote header
    $sql = "
        SELECT
            q.id,
            q.client_id,
            COALESCE(c.name, CONCAT('Client #', q.client_id)) AS client_name,
            q.status,
            q.title,
            q.notes,
            q.created_at
        FROM quotes q
        LEFT JOIN clients c ON c.id = q.client_id
        WHERE q.id = :id
        LIMIT 1
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $quote = $stmt->fetch();

    if (!$quote) {
        http_response_code(404);
        echo json_encode(['error' => 'Quote not found']);
        exit;
    }

    // Fetch items snapshot
    $sqlItems = "
        SELECT
            id,
            item_id,
            description,
            quantity,
            rate,
            line_total
        FROM quote_items
        WHERE quote_id = :id
        ORDER BY id ASC
    ";
    $stmtItems = $pdo->prepare($sqlItems);
    $stmtItems->execute([':id' => $id]);
    $items = $stmtItems->fetchAll();

    echo json_encode([
        'quote' => $quote,
        'items' => $items,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load quote']);
}
