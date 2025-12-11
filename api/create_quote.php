<?php
// api/create_quote.php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/../db_config.php'; // gives us $pdo (PDO with exceptions)

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

// Read JSON body
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload.']);
    exit;
}

// Basic fields
$clientId = isset($data['client_id']) ? (int)$data['client_id'] : 0;
$status   = isset($data['status']) ? trim($data['status']) : 'draft';
$title    = isset($data['title']) ? trim($data['title']) : '';
$notes    = isset($data['notes']) ? trim($data['notes']) : '';
$items    = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];

// Basic validation
if ($clientId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Client is required.']);
    exit;
}

if (empty($items)) {
    http_response_code(400);
    echo json_encode(['error' => 'At least one line item is required.']);
    exit;
}

// Only allow statuses that exist in our ENUM
if (!in_array($status, ['draft', 'issued'], true)) {
    $status = 'draft';
}

try {
    $pdo->beginTransaction();

    // Insert into quotes
    $insertQuote = $pdo->prepare("
        INSERT INTO quotes (client_id, status, notes, title)
        VALUES (:client_id, :status, :notes, :title)
    ");

    $insertQuote->execute([
        ':client_id' => $clientId,
        ':status'    => $status,
        ':notes'     => $notes,
        ':title'     => $title,
    ]);

    $quoteId = (int)$pdo->lastInsertId();

    // Insert line items
    $insertItem = $pdo->prepare("
        INSERT INTO quote_items
            (quote_id, item_id, description, quantity, rate, line_total)
        VALUES
            (:quote_id, :item_id, :description, :quantity, :rate, :line_total)
    ");

    $subtotal = 0.0;

    foreach ($items as $item) {
        $itemId = isset($item['item_id']) ? (int)$item['item_id'] : null;
        if ($itemId <= 0) {
            $itemId = null; // custom item
        }

        $description = isset($item['description']) ? trim($item['description']) : '';
        $quantity    = isset($item['quantity']) ? (int)$item['quantity'] : 0;
        $rate        = isset($item['rate']) ? (float)$item['rate'] : 0.0;

        // Skip completely empty / invalid rows
        if ($quantity <= 0) {
            continue;
        }
        if ($description === '' && $itemId === null) {
            continue;
        }

        $lineTotal = $quantity * $rate;
        $subtotal += $lineTotal;

        $insertItem->execute([
            ':quote_id'   => $quoteId,
            ':item_id'    => $itemId,
            ':description'=> $description,
            ':quantity'   => $quantity,
            ':rate'       => $rate,
            ':line_total' => $lineTotal,
        ]);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'quote' => [
            'id'         => $quoteId,
            'client_id'  => $clientId,
            'status'     => $status,
            'title'      => $title,
            'total'      => $subtotal,
        ],
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save quote.']);
}
