<?php
// api/create_quote.php
// Create or update a quote + line items from JSON payload.

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/../db_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$quoteId   = isset($data['id']) ? (int) $data['id'] : 0;
$clientId  = isset($data['client_id']) ? (int) $data['client_id'] : 0;
$status    = isset($data['status']) ? trim($data['status']) : 'draft';
$title     = isset($data['title']) ? trim($data['title']) : '';
$notes     = isset($data['notes']) ? trim($data['notes']) : '';
$items     = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];

if ($clientId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing client_id']);
    exit;
}
if (empty($items)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'At least one line item is required']);
    exit;
}

$allowedStatuses = ['draft', 'issued', 'converted', 'cancelled'];
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'draft';
}

try {
    $pdo->beginTransaction();

    if ($quoteId > 0) {
        // Update existing quote
        $sql = "
            UPDATE quotes
            SET client_id = :client_id,
                status    = :status,
                notes     = :notes,
                title     = :title,
                updated_at = NOW()
            WHERE id = :id
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':client_id' => $clientId,
            ':status'    => $status,
            ':notes'     => $notes,
            ':title'     => $title,
            ':id'        => $quoteId,
        ]);

        // Remove old items snapshot
        $del = $pdo->prepare("DELETE FROM quote_items WHERE quote_id = :id");
        $del->execute([':id' => $quoteId]);
    } else {
        // New quote
        $sql = "
            INSERT INTO quotes (client_id, status, notes, title, created_at, updated_at)
            VALUES (:client_id, :status, :notes, :title, NOW(), NOW())
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':client_id' => $clientId,
            ':status'    => $status,
            ':notes'     => $notes,
            ':title'     => $title,
        ]);
        $quoteId = (int) $pdo->lastInsertId();
    }

    // Insert current items snapshot
    $itemSql = "
        INSERT INTO quote_items
            (quote_id, item_id, description, quantity, rate, line_total)
        VALUES
            (:quote_id, :item_id, :description, :quantity, :rate, :line_total)
    ";
    $itemStmt = $pdo->prepare($itemSql);

    foreach ($items as $it) {
        $itemId      = isset($it['item_id']) ? (int) $it['item_id'] : null;
        $description = isset($it['description']) ? trim($it['description']) : '';
        $quantity    = isset($it['quantity']) ? (float) $it['quantity'] : 0;
        $rate        = isset($it['rate']) ? (float) $it['rate'] : 0;
        $lineTotal   = isset($it['line_total']) ? (float) $it['line_total'] : ($quantity * $rate);

        if (!$description && !$itemId) {
            continue;
        }

        $itemStmt->execute([
            ':quote_id'   => $quoteId,
            ':item_id'    => $itemId ?: null,
            ':description'=> $description,
            ':quantity'   => $quantity,
            ':rate'       => $rate,
            ':line_total' => $lineTotal,
        ]);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'id'      => $quoteId,
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database error saving quote',
    ]);
}
