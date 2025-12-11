<?php
// api/list_quotes.php
// Return a small list of recent quotes for the sidebar.

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/../db_config.php';

try {
    $sql = "
        SELECT
            q.id,
            q.client_id,
            COALESCE(c.name, CONCAT('Client #', q.client_id)) AS client_name,
            q.status,
            q.title,
            q.created_at,
            COALESCE(SUM(qi.line_total), 0) AS total
        FROM quotes q
        LEFT JOIN clients c ON c.id = q.client_id
        LEFT JOIN quote_items qi ON qi.quote_id = q.id
        WHERE q.status <> 'converted'
        GROUP BY
            q.id,
            q.client_id,
            client_name,
            q.status,
            q.title,
            q.created_at
        ORDER BY q.created_at DESC
        LIMIT 50
    ";
    $stmt = $pdo->query($sql);
    $quotes = $stmt->fetchAll();

    echo json_encode([
        'results' => $quotes,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to list quotes',
    ]);
}
